<?php
/**
 * Plugin Name: SiteKit Contact Form
 * Description: A small, dependency-free contact form for SiteKit sites. Emails each message to the business and keeps a copy under "Messages" in wp-admin, so nothing is lost if email delivery fails.
 * Version: 1.0.0
 * Requires at least: 6.2
 * Requires PHP: 7.4
 * License: GPL-2.0-or-later
 *
 * Usage: [sitekit_contact to="hello@business.com"]  (defaults to the site admin email)
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const SITEKIT_CF_MIN_SECONDS = 3;   // Faster than this is a bot.
const SITEKIT_CF_MAX_PER_HOUR = 5;  // Per visitor IP.

/** Messages are stored as a private post type, listed under "Messages" in wp-admin. */
add_action( 'init', function () {
	register_post_type( 'sitekit_message', array(
		'labels'          => array(
			'name'          => 'Messages',
			'singular_name' => 'Message',
			'menu_name'     => 'Messages',
			'all_items'     => 'All messages',
			'edit_item'     => 'Message',
			'not_found'     => 'No messages yet.',
		),
		'public'          => false,
		'show_ui'         => true,
		'show_in_menu'    => true,
		'menu_icon'       => 'dashicons-email-alt',
		'menu_position'   => 25,
		'supports'        => array( 'title', 'editor' ),
		'capability_type' => 'post',
		'capabilities'    => array( 'create_posts' => 'do_not_allow' ),
		'map_meta_cap'    => true,
	) );
	add_shortcode( 'sitekit_contact', 'sitekit_cf_render' );
} );

/** Lets SiteKit check that the plugin is active before it puts the form on a page. */
add_action( 'rest_api_init', function () {
	register_rest_route( 'sitekit/v1', '/contact-form', array(
		'methods'             => 'GET',
		'permission_callback' => '__return_true',
		'callback'            => function () {
			return array( 'active' => true, 'version' => '1.0.0' );
		},
	) );
} );

/** Signs values the browser sends back (recipient, start time) so they can't be forged. */
function sitekit_cf_sign( $value ) {
	return hash_hmac( 'sha256', (string) $value, wp_salt( 'nonce' ) );
}

function sitekit_cf_recipient( $to ) {
	$to = sanitize_email( (string) $to );
	return is_email( $to ) ? $to : get_option( 'admin_email' );
}

function sitekit_cf_client_ip() {
	return isset( $_SERVER['REMOTE_ADDR'] ) ? preg_replace( '/[^0-9a-f:.]/i', '', wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : 'unknown';
}

/** Result of a submission on this request, read by the shortcode when it renders. */
$GLOBALS['sitekit_cf_state'] = array( 'errors' => array(), 'old' => array() );

/**
 * Handles a submitted form before the page renders. On success it redirects
 * (so a refresh doesn't send the message twice); on error the page renders with messages.
 */
add_action( 'template_redirect', function () {
	if ( 'POST' !== ( $_SERVER['REQUEST_METHOD'] ?? '' ) || empty( $_POST['sitekit_cf'] ) ) {
		return;
	}
	$p   = wp_unslash( $_POST );
	$old = array(
		'name'    => sanitize_text_field( $p['sk_name'] ?? '' ),
		'email'   => sanitize_email( $p['sk_email'] ?? '' ),
		'phone'   => sanitize_text_field( $p['sk_phone'] ?? '' ),
		'message' => sanitize_textarea_field( $p['sk_message'] ?? '' ),
	);
	$errors = array();

	$started  = (int) ( $p['sk_t'] ?? 0 );
	$to       = (string) ( $p['sk_to'] ?? '' );
	$is_bot   = ! empty( $p['sk_website'] )                                           // Hidden field humans never see.
		|| ! hash_equals( sitekit_cf_sign( $started . '|' . $to ), (string) ( $p['sk_sig'] ?? '' ) )
		|| time() - $started < SITEKIT_CF_MIN_SECONDS;

	$rate_key = 'sitekit_cf_' . md5( sitekit_cf_client_ip() );
	$count    = (int) get_transient( $rate_key );

	if ( $is_bot ) {
		// Pretend it worked so bots learn nothing.
		wp_safe_redirect( add_query_arg( 'sk_sent', '1', wp_get_referer() ?: home_url( '/' ) ) . '#sk-contact' );
		exit;
	}
	if ( $count >= SITEKIT_CF_MAX_PER_HOUR ) {
		$errors[] = 'Too many messages from your connection. Please try again later, or email us directly.';
	}
	if ( '' === $old['name'] || strlen( $old['name'] ) > 120 ) {
		$errors[] = 'Please enter your name.';
	}
	if ( ! is_email( $old['email'] ) ) {
		$errors[] = 'Please enter a valid email address so we can reply.';
	}
	if ( strlen( $old['message'] ) < 5 || strlen( $old['message'] ) > 5000 ) {
		$errors[] = 'Please write a message (up to 5000 characters).';
	}

	if ( $errors ) {
		$GLOBALS['sitekit_cf_state'] = array( 'errors' => $errors, 'old' => $old );
		return;
	}

	set_transient( $rate_key, $count + 1, HOUR_IN_SECONDS );

	$page = wp_get_referer() ?: home_url( '/' );
	$post_id = wp_insert_post( array(
		'post_type'    => 'sitekit_message',
		'post_status'  => 'private',
		// Parentheses, not <angle brackets>: WordPress strips those from titles as HTML.
		'post_title'   => sprintf( '%s (%s)', $old['name'], $old['email'] ),
		'post_content' => $old['message'],
	) );
	if ( $post_id && ! is_wp_error( $post_id ) ) {
		update_post_meta( $post_id, '_sk_email', $old['email'] );
		update_post_meta( $post_id, '_sk_phone', $old['phone'] );
		update_post_meta( $post_id, '_sk_page', esc_url_raw( $page ) );
	}

	$recipient = sitekit_cf_recipient( $to );
	$body      = sprintf(
		"New message from your website.\n\nName: %s\nEmail: %s\nPhone: %s\nPage: %s\n\n%s\n",
		$old['name'],
		$old['email'],
		$old['phone'] ?: '-',
		$page,
		$old['message']
	);
	$sent = wp_mail(
		$recipient,
		sprintf( 'Website message from %s', $old['name'] ),
		$body,
		array( 'Reply-To: ' . $old['name'] . ' <' . $old['email'] . '>' )
	);
	if ( $post_id && ! is_wp_error( $post_id ) ) {
		update_post_meta( $post_id, '_sk_emailed', $sent ? 1 : 0 );
	}

	wp_safe_redirect( add_query_arg( 'sk_sent', '1', $page ) . '#sk-contact' );
	exit;
} );

function sitekit_cf_render( $atts ) {
	$atts    = shortcode_atts( array( 'to' => '', 'lang' => 'en' ), $atts, 'sitekit_contact' );
	// [sitekit_contact lang="ne"]: the form in Nepali (bilingual sites).
	$ne = 'ne' === $atts['lang'];
	$L  = $ne ? array(
		'ok'       => 'धन्यवाद! तपाईंको सन्देश पठाइयो। हामी छिट्टै सम्पर्क गर्नेछौं।',
		'name'     => 'नाम',
		'email'    => 'इमेल',
		'phone'    => 'फोन',
		'optional' => '(ऐच्छिक)',
		'message'  => 'सन्देश',
		'send'     => 'सन्देश पठाउनुहोस्',
	) : array(
		'ok'       => "Thanks! Your message has been sent. We'll get back to you soon.",
		'name'     => 'Name',
		'email'    => 'Email',
		'phone'    => 'Phone',
		'optional' => '(optional)',
		'message'  => 'Message',
		'send'     => 'Send message',
	);
	$error_ne = array(
		'Too many messages from your connection. Please try again later, or email us directly.' => 'तपाईंको जडानबाट धेरै सन्देश आए। केही समयपछि प्रयास गर्नुहोस्, वा हामीलाई सिधै इमेल गर्नुहोस्।',
		'Please enter your name.' => 'कृपया आफ्नो नाम लेख्नुहोस्।',
		'Please enter a valid email address so we can reply.' => 'जवाफ दिन सकियोस् भनेर सही इमेल ठेगाना लेख्नुहोस्।',
		'Please write a message (up to 5000 characters).' => 'कृपया सन्देश लेख्नुहोस् (५००० अक्षरसम्म)।',
	);
	$to      = sitekit_cf_recipient( $atts['to'] );
	$state   = $GLOBALS['sitekit_cf_state'];
	$old     = $state['old'];
	$started = time();
	$val     = function ( $key ) use ( $old ) {
		return esc_attr( $old[ $key ] ?? '' );
	};

	ob_start();
	?>
	<div class="sk-contact" id="sk-contact">
		<?php if ( isset( $_GET['sk_sent'] ) ) : ?>
			<p class="sk-contact__ok" role="status"><?php echo esc_html( $L['ok'] ); ?></p>
		<?php endif; ?>
		<?php if ( $state['errors'] ) : ?>
			<div class="sk-contact__errors" role="alert"><ul>
				<?php foreach ( $state['errors'] as $error ) : ?>
					<li><?php echo esc_html( $ne && isset( $error_ne[ $error ] ) ? $error_ne[ $error ] : $error ); ?></li>
				<?php endforeach; ?>
			</ul></div>
		<?php endif; ?>
		<form method="post" action="<?php echo esc_url( get_permalink() . '#sk-contact' ); ?>" novalidate>
			<input type="hidden" name="sitekit_cf" value="1">
			<input type="hidden" name="sk_t" value="<?php echo esc_attr( $started ); ?>">
			<input type="hidden" name="sk_to" value="<?php echo esc_attr( $atts['to'] ); ?>">
			<input type="hidden" name="sk_sig" value="<?php echo esc_attr( sitekit_cf_sign( $started . '|' . $atts['to'] ) ); ?>">
			<p class="sk-contact__trap" aria-hidden="true"><label>Website <input type="text" name="sk_website" tabindex="-1" autocomplete="off"></label></p>
			<p><label><?php echo esc_html( $L['name'] ); ?> <span aria-hidden="true">*</span><input type="text" name="sk_name" required maxlength="120" autocomplete="name" value="<?php echo $val( 'name' ); ?>"></label></p>
			<p><label><?php echo esc_html( $L['email'] ); ?> <span aria-hidden="true">*</span><input type="email" name="sk_email" required autocomplete="email" value="<?php echo $val( 'email' ); ?>"></label></p>
			<p><label><?php echo esc_html( $L['phone'] ); ?> <small><?php echo esc_html( $L['optional'] ); ?></small><input type="tel" name="sk_phone" autocomplete="tel" value="<?php echo $val( 'phone' ); ?>"></label></p>
			<p><label><?php echo esc_html( $L['message'] ); ?> <span aria-hidden="true">*</span><textarea name="sk_message" rows="5" required maxlength="5000"><?php echo esc_textarea( $old['message'] ?? '' ); ?></textarea></label></p>
			<p><button type="submit" class="wp-element-button"><?php echo esc_html( $L['send'] ); ?></button></p>
		</form>
	</div>
	<style>
		.sk-contact{scroll-margin-top:140px}/* keep the thank-you clear of a sticky header */
		.sk-contact form p{margin:0 0 1rem}
		.sk-contact button.wp-element-button{border-radius:999px;cursor:pointer;border:0}
		.sk-contact label{display:block;font-weight:600;font-size:.95rem}
		.sk-contact input,.sk-contact textarea{display:block;width:100%;box-sizing:border-box;margin-top:.35rem;padding:.7rem .8rem;font:inherit;color:inherit;background:#fff;border:1px solid rgba(0,0,0,.2);border-radius:10px}
		.sk-contact input:focus,.sk-contact textarea:focus{outline:2px solid currentColor;outline-offset:1px}
		.sk-contact small{font-weight:400;opacity:.7}
		.sk-contact__trap{position:absolute!important;left:-10000px;width:1px;height:1px;overflow:hidden}
		.sk-contact__ok{padding:.8rem 1rem;border-radius:10px;background:#e7f8f0;color:#065f46;font-weight:600}
		.sk-contact__errors{padding:.6rem 1rem;border-radius:10px;background:#fdecec;color:#991b1b;margin-bottom:1rem}
		.sk-contact__errors ul{margin:0;padding-left:1.1rem}
	</style>
	<?php
	return ob_get_clean();
}

/** wp-admin list: show email, phone and whether the email went out. */
add_filter( 'manage_sitekit_message_posts_columns', function ( $cols ) {
	return array(
		'cb'         => $cols['cb'],
		'title'      => 'From',
		'sk_phone'   => 'Phone',
		'sk_emailed' => 'Emailed',
		'date'       => 'Received',
	);
} );
add_action( 'manage_sitekit_message_posts_custom_column', function ( $col, $post_id ) {
	if ( 'sk_phone' === $col ) {
		echo esc_html( get_post_meta( $post_id, '_sk_phone', true ) ?: '-' );
	}
	if ( 'sk_emailed' === $col ) {
		echo get_post_meta( $post_id, '_sk_emailed', true ) ? 'Yes' : '<strong style="color:#b32d2e">No: check email delivery</strong>';
	}
}, 10, 2 );
