<?php
/**
 * Plugin Name: SiteKit Nepal Payments
 * Description: eSewa and Khalti payments for WooCommerce. Starts in test mode (eSewa's public test merchant; Khalti's sandbox once you add your test key). Switch to live in WooCommerce > Settings > Payments with the merchant keys eSewa and Khalti give the shop owner.
 * Version: 1.0.0
 * Requires at least: 6.2
 * Requires PHP: 7.4
 * Requires Plugins: woocommerce
 * License: GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'plugins_loaded', function () {
	if ( ! class_exists( 'WC_Payment_Gateway' ) ) {
		return;
	}

	/** Shared bits: amounts in rupees, logging to the order. */
	abstract class SiteKit_NP_Gateway extends WC_Payment_Gateway {
		protected function rupees( $order ) {
			return round( (float) $order->get_total(), 2 );
		}

		protected function test_mode() {
			return 'yes' === $this->get_option( 'testmode', 'yes' );
		}

		protected function api_url( $name ) {
			return home_url( '/wc-api/' . $name . '/' );
		}

		protected function fail( $order, $note ) {
			if ( $order && ! $order->is_paid() ) {
				$order->update_status( 'failed', $note );
			}
			wc_add_notice( 'The payment was not completed. Please try again, or choose another payment method.', 'error' );
			wp_safe_redirect( wc_get_checkout_url() );
			exit;
		}

		public function is_available() {
			if ( 'NPR' !== get_woocommerce_currency() ) {
				return false; // eSewa and Khalti take Nepali rupees only.
			}
			return parent::is_available();
		}
	}

	/*
	 * eSewa ePay v2: the browser posts a signed form to eSewa; eSewa redirects back with a
	 * base64 JSON result, whose signature we check, then we confirm with eSewa's status API.
	 * Signature: base64(HMAC-SHA256("total_amount=..,transaction_uuid=..,product_code=..", secret)).
	 */
	class SiteKit_Esewa_Gateway extends SiteKit_NP_Gateway {
		const TEST_PRODUCT = 'EPAYTEST';
		const TEST_SECRET  = '8gBm/:&EnhH.1/q'; // eSewa's published test merchant key.

		public function __construct() {
			$this->id                 = 'sitekit_esewa';
			$this->method_title       = 'eSewa';
			$this->method_description = 'Customers pay with their eSewa wallet. Test mode uses eSewa\'s public test merchant; sign in on eSewa\'s test page with the test eSewa IDs listed at developer.esewa.com.np.';
			$this->has_fields         = false;
			$this->init_form_fields();
			$this->init_settings();
			$this->title       = $this->get_option( 'title', 'eSewa' );
			$this->description = $this->get_option( 'description' );
			add_action( 'woocommerce_update_options_payment_gateways_' . $this->id, array( $this, 'process_admin_options' ) );
			add_action( 'woocommerce_api_sitekit_esewa_pay', array( $this, 'pay_page' ) );
			add_action( 'woocommerce_api_sitekit_esewa_return', array( $this, 'handle_return' ) );
			add_action( 'woocommerce_api_sitekit_esewa_fail', array( $this, 'handle_fail' ) );
		}

		public function init_form_fields() {
			$this->form_fields = array(
				'enabled'      => array( 'title' => 'Enable', 'type' => 'checkbox', 'label' => 'Accept eSewa', 'default' => 'yes' ),
				'title'        => array( 'title' => 'Title', 'type' => 'text', 'default' => 'eSewa' ),
				'description'  => array( 'title' => 'Description', 'type' => 'text', 'default' => 'Pay securely with your eSewa wallet.' ),
				'testmode'     => array( 'title' => 'Test mode', 'type' => 'checkbox', 'label' => 'Use eSewa\'s test server (no real money)', 'default' => 'yes' ),
				'product_code' => array( 'title' => 'Merchant code (live)', 'type' => 'text', 'description' => 'From eSewa, for the shop owner\'s merchant account.' ),
				'secret_key'   => array( 'title' => 'Secret key (live)', 'type' => 'password', 'description' => 'From eSewa.' ),
			);
		}

		private function creds() {
			return $this->test_mode()
				? array( self::TEST_PRODUCT, self::TEST_SECRET, 'https://rc-epay.esewa.com.np/api/epay/main/v2/form', 'https://rc.esewa.com.np/api/epay/transaction/status/' )
				: array( $this->get_option( 'product_code' ), $this->get_option( 'secret_key' ), 'https://epay.esewa.com.np/api/epay/main/v2/form', 'https://esewa.com.np/api/epay/transaction/status/' );
		}

		public function is_available() {
			list( $code, $secret ) = $this->creds();
			return $code && $secret && parent::is_available();
		}

		public static function sign( $message, $secret ) {
			return base64_encode( hash_hmac( 'sha256', $message, $secret, true ) );
		}

		private static function fmt( $n ) {
			// eSewa signs the amount as sent; whole rupees go without decimals.
			return ( floor( $n ) == $n ) ? (string) (int) $n : number_format( $n, 2, '.', '' );
		}

		public function process_payment( $order_id ) {
			$order = wc_get_order( $order_id );
			// A fresh transaction id per attempt (eSewa rejects reused ids).
			$uuid = $order_id . '-' . time();
			$order->update_meta_data( '_sitekit_esewa_uuid', $uuid );
			$order->save();
			return array(
				'result'   => 'success',
				'redirect' => add_query_arg( array( 'order' => $order_id, 'key' => $order->get_order_key() ), $this->api_url( 'sitekit_esewa_pay' ) ),
			);
		}

		// A page that posts the signed form to eSewa straight away.
		public function pay_page() {
			$order = wc_get_order( absint( $_GET['order'] ?? 0 ) );
			if ( ! $order || ! hash_equals( $order->get_order_key(), (string) ( $_GET['key'] ?? '' ) ) || $order->is_paid() ) {
				wp_die( 'This payment link is not valid.' );
			}
			list( $code, $secret, $form_url ) = $this->creds();
			$total  = self::fmt( $this->rupees( $order ) );
			$uuid   = $order->get_meta( '_sitekit_esewa_uuid' );
			$fields = array(
				'amount'                  => $total,
				'tax_amount'              => '0',
				'product_service_charge'  => '0',
				'product_delivery_charge' => '0',
				'total_amount'            => $total,
				'transaction_uuid'        => $uuid,
				'product_code'            => $code,
				'success_url'             => $this->api_url( 'sitekit_esewa_return' ),
				'failure_url'             => $this->api_url( 'sitekit_esewa_fail' ) . '?order=' . $order->get_id(),
				'signed_field_names'      => 'total_amount,transaction_uuid,product_code',
			);
			$fields['signature'] = self::sign( "total_amount={$total},transaction_uuid={$uuid},product_code={$code}", $secret );
			nocache_headers();
			echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Redirecting to eSewa…</title></head><body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:90vh;color:#333">';
			echo '<form id="esewa" method="post" action="' . esc_url( $form_url ) . '"><p>Taking you to eSewa to pay…</p>';
			foreach ( $fields as $k => $v ) {
				echo '<input type="hidden" name="' . esc_attr( $k ) . '" value="' . esc_attr( $v ) . '">';
			}
			echo '<noscript><button type="submit">Continue to eSewa</button></noscript></form><script>document.getElementById("esewa").submit()</script></body></html>';
			exit;
		}

		public function handle_return() {
			$raw  = isset( $_GET['data'] ) ? wp_unslash( $_GET['data'] ) : '';
			$data = json_decode( base64_decode( strtr( (string) $raw, ' ', '+' ) ), true );
			$uuid = is_array( $data ) ? (string) ( $data['transaction_uuid'] ?? '' ) : '';
			$order = wc_get_order( absint( strtok( $uuid, '-' ) ) );
			if ( ! $order || $order->get_meta( '_sitekit_esewa_uuid' ) !== $uuid ) {
				wp_die( 'Unknown eSewa transaction.' );
			}
			if ( $order->is_paid() ) {
				wp_safe_redirect( $this->get_return_url( $order ) );
				exit;
			}
			list( $code, $secret, , $status_url ) = $this->creds();
			// 1. The signature over the fields eSewa lists in signed_field_names.
			$names   = explode( ',', (string) ( $data['signed_field_names'] ?? '' ) );
			$message = implode( ',', array_map( function ( $n ) use ( $data ) {
				return $n . '=' . ( $data[ $n ] ?? '' );
			}, $names ) );
			if ( ! hash_equals( self::sign( $message, $secret ), (string) ( $data['signature'] ?? '' ) ) ) {
				$this->fail( $order, 'eSewa: the reply signature did not match.' );
			}
			$total = self::fmt( $this->rupees( $order ) );
			// 2. Ask eSewa directly, so a forged or replayed reply can't mark the order paid.
			$check = wp_remote_get( add_query_arg( array( 'product_code' => $code, 'total_amount' => $total, 'transaction_uuid' => $uuid ), $status_url ), array( 'timeout' => 20 ) );
			$body  = is_wp_error( $check ) ? null : json_decode( wp_remote_retrieve_body( $check ), true );
			$ok    = is_array( $body ) && 'COMPLETE' === ( $body['status'] ?? '' ) && 'COMPLETE' === ( $data['status'] ?? '' )
				&& abs( (float) str_replace( ',', '', (string) ( $data['total_amount'] ?? 0 ) ) - (float) $total ) < 0.01;
			if ( ! $ok ) {
				$this->fail( $order, 'eSewa: payment not confirmed (' . sanitize_text_field( $body['status'] ?? 'no reply' ) . ').' );
			}
			$order->payment_complete( sanitize_text_field( $data['transaction_code'] ?? $body['ref_id'] ?? '' ) );
			$order->add_order_note( 'Paid with eSewa' . ( $this->test_mode() ? ' (TEST mode)' : '' ) . '. Reference: ' . sanitize_text_field( $data['transaction_code'] ?? '' ) );
			WC()->cart && WC()->cart->empty_cart();
			wp_safe_redirect( $this->get_return_url( $order ) );
			exit;
		}

		public function handle_fail() {
			$order = wc_get_order( absint( $_GET['order'] ?? 0 ) );
			$this->fail( $order, 'eSewa: the customer cancelled or the payment failed.' );
		}
	}

	/*
	 * Khalti ePayment (KPG-2): the server starts a payment and sends the customer to Khalti's
	 * page; Khalti returns them with a pidx, which we look up server-side before marking paid.
	 */
	class SiteKit_Khalti_Gateway extends SiteKit_NP_Gateway {
		public function __construct() {
			$this->id                 = 'sitekit_khalti';
			$this->method_title       = 'Khalti';
			$this->method_description = 'Customers pay with Khalti (wallet, mobile banking, cards). Needs a secret key: a test key from test-admin.khalti.com, or the live key from admin.khalti.com.';
			$this->has_fields         = false;
			$this->init_form_fields();
			$this->init_settings();
			$this->title       = $this->get_option( 'title', 'Khalti' );
			$this->description = $this->get_option( 'description' );
			add_action( 'woocommerce_update_options_payment_gateways_' . $this->id, array( $this, 'process_admin_options' ) );
			add_action( 'woocommerce_api_sitekit_khalti_return', array( $this, 'handle_return' ) );
		}

		public function init_form_fields() {
			$this->form_fields = array(
				'enabled'     => array( 'title' => 'Enable', 'type' => 'checkbox', 'label' => 'Accept Khalti', 'default' => 'yes' ),
				'title'       => array( 'title' => 'Title', 'type' => 'text', 'default' => 'Khalti' ),
				'description' => array( 'title' => 'Description', 'type' => 'text', 'default' => 'Pay with Khalti wallet, mobile banking or card.' ),
				'testmode'    => array( 'title' => 'Test mode', 'type' => 'checkbox', 'label' => 'Use Khalti\'s sandbox (no real money)', 'default' => 'yes' ),
				'secret_key'  => array( 'title' => 'Secret key', 'type' => 'password', 'description' => 'Test key in test mode, live key otherwise.' ),
			);
		}

		private function base() {
			return $this->test_mode() ? 'https://dev.khalti.com/api/v2/epayment/' : 'https://khalti.com/api/v2/epayment/';
		}

		private function call( $path, $payload ) {
			$res = wp_remote_post( $this->base() . $path, array(
				'timeout' => 20,
				'headers' => array( 'Authorization' => 'Key ' . $this->get_option( 'secret_key' ), 'Content-Type' => 'application/json' ),
				'body'    => wp_json_encode( $payload ),
			) );
			return is_wp_error( $res ) ? array() : (array) json_decode( wp_remote_retrieve_body( $res ), true );
		}

		public function is_available() {
			return '' !== (string) $this->get_option( 'secret_key' ) && parent::is_available();
		}

		public function process_payment( $order_id ) {
			$order = wc_get_order( $order_id );
			$paisa = (int) round( $this->rupees( $order ) * 100 );
			if ( $paisa < 1000 ) {
				wc_add_notice( 'Khalti needs an order of at least Rs. 10.', 'error' );
				return array( 'result' => 'failure' );
			}
			$reply = $this->call( 'initiate/', array(
				'return_url'          => $this->api_url( 'sitekit_khalti_return' ),
				'website_url'         => home_url( '/' ),
				'amount'              => $paisa,
				'purchase_order_id'   => (string) $order_id,
				'purchase_order_name' => 'Order #' . $order->get_order_number(),
				'customer_info'       => array_filter( array(
					'name'  => trim( $order->get_billing_first_name() . ' ' . $order->get_billing_last_name() ),
					'email' => $order->get_billing_email(),
					'phone' => $order->get_billing_phone(),
				) ),
			) );
			if ( empty( $reply['payment_url'] ) || empty( $reply['pidx'] ) ) {
				wc_add_notice( 'Khalti is not available right now. Please choose another payment method.', 'error' );
				$order->add_order_note( 'Khalti: could not start the payment. ' . sanitize_text_field( wp_json_encode( $reply ) ) );
				return array( 'result' => 'failure' );
			}
			$order->update_meta_data( '_sitekit_khalti_pidx', sanitize_text_field( $reply['pidx'] ) );
			$order->save();
			return array( 'result' => 'success', 'redirect' => esc_url_raw( $reply['payment_url'] ) );
		}

		public function handle_return() {
			$order = wc_get_order( absint( $_GET['purchase_order_id'] ?? 0 ) );
			$pidx  = sanitize_text_field( wp_unslash( $_GET['pidx'] ?? '' ) );
			if ( ! $order || ! $pidx || $order->get_meta( '_sitekit_khalti_pidx' ) !== $pidx ) {
				wp_die( 'Unknown Khalti payment.' );
			}
			if ( $order->is_paid() ) {
				wp_safe_redirect( $this->get_return_url( $order ) );
				exit;
			}
			// Never trust the redirect alone: look the payment up with Khalti.
			$look  = $this->call( 'lookup/', array( 'pidx' => $pidx ) );
			$paisa = (int) round( $this->rupees( $order ) * 100 );
			if ( 'Completed' !== ( $look['status'] ?? '' ) || (int) ( $look['total_amount'] ?? 0 ) !== $paisa ) {
				$this->fail( $order, 'Khalti: payment not completed (' . sanitize_text_field( $look['status'] ?? 'no reply' ) . ').' );
			}
			$order->payment_complete( sanitize_text_field( $look['transaction_id'] ?? $pidx ) );
			$order->add_order_note( 'Paid with Khalti' . ( $this->test_mode() ? ' (TEST mode)' : '' ) . '. Transaction: ' . sanitize_text_field( $look['transaction_id'] ?? '' ) );
			WC()->cart && WC()->cart->empty_cart();
			wp_safe_redirect( $this->get_return_url( $order ) );
			exit;
		}
	}

	add_filter( 'woocommerce_payment_gateways', function ( $gateways ) {
		$gateways[] = 'SiteKit_Esewa_Gateway';
		$gateways[] = 'SiteKit_Khalti_Gateway';
		return $gateways;
	} );
}, 20 );

// Nepal defaults when a shop is set up: rupees, Nepal, cash on delivery on.
register_activation_hook( __FILE__, function () {
	if ( ! get_option( 'sitekit_np_defaults_done' ) ) {
		update_option( 'woocommerce_currency', 'NPR' );
		update_option( 'woocommerce_default_country', 'NP' );
		update_option( 'woocommerce_currency_pos', 'left_space' );
		update_option( 'woocommerce_price_num_decimals', '0' );
		update_option( 'sitekit_np_defaults_done', 1 );
	}
} );
