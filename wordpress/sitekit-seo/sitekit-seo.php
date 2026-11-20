<?php
/**
 * Plugin Name: SiteKit SEO
 * Description: Search and sharing basics for SiteKit sites: a written title and meta description per page, Open Graph and Twitter cards with an image, and LocalBusiness structured data on the homepage. SiteKit fills these in on each push; pages edited by hand fall back to sensible defaults. If a dedicated SEO plugin (Yoast, Rank Math, SEOPress, All in One SEO) is active, this plugin steps aside.
 * Version: 1.1.0
 * Requires at least: 6.2
 * Requires PHP: 7.4
 * License: GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Another SEO plugin is in charge: don't print duplicate tags. */
function sitekit_seo_other_plugin_active() {
	return defined( 'WPSEO_VERSION' ) || defined( 'RANK_MATH_VERSION' ) || defined( 'SEOPRESS_VERSION' ) || defined( 'AIOSEO_VERSION' );
}

/** Fields SiteKit writes through the REST API on each push. */
add_action( 'init', function () {
	$can_edit = function () {
		return current_user_can( 'edit_pages' );
	};
	foreach ( array( 'sitekit_seo_title', 'sitekit_seo_description', 'sitekit_lang', 'sitekit_alt' ) as $key ) {
		register_post_meta( 'page', $key, array(
			'type'              => 'string',
			'single'            => true,
			'show_in_rest'      => true,
			'sanitize_callback' => 'sanitize_text_field',
			'auth_callback'     => $can_edit,
		) );
	}
	register_setting( 'general', 'sitekit_schema', array(
		'type'              => 'string',
		'default'           => '',
		'show_in_rest'      => true,
		'sanitize_callback' => function ( $value ) {
			// Only keep valid JSON, re-encoded by WordPress (nothing else gets into the page).
			$data = json_decode( (string) $value, true );
			return is_array( $data ) ? wp_json_encode( $data ) : '';
		},
	) );
} );

function sitekit_seo_page_meta( $key ) {
	if ( ! is_singular() ) {
		return '';
	}
	return trim( (string) get_post_meta( get_queried_object_id(), $key, true ) );
}

/** Page title: the written one, or WordPress's default. */
add_filter( 'pre_get_document_title', function ( $title ) {
	if ( sitekit_seo_other_plugin_active() ) {
		return $title;
	}
	$custom = sitekit_seo_page_meta( 'sitekit_seo_title' );
	return '' !== $custom ? $custom : $title;
}, 20 );

/** Description: the written one, else the page's opening text, else the site tagline. */
function sitekit_seo_description() {
	$custom = sitekit_seo_page_meta( 'sitekit_seo_description' );
	if ( '' !== $custom ) {
		return $custom;
	}
	if ( is_singular() ) {
		$text = wp_strip_all_tags( strip_shortcodes( get_post_field( 'post_content', get_queried_object_id() ) ) );
		$text = trim( preg_replace( '/\s+/', ' ', $text ) );
		if ( '' !== $text ) {
			return wp_html_excerpt( $text, 155, '…' );
		}
	}
	return get_bloginfo( 'description' );
}

/** Sharing image: the first photo on the page, else the site logo. */
function sitekit_seo_image() {
	if ( is_singular() ) {
		$content = get_post_field( 'post_content', get_queried_object_id() );
		if ( preg_match( '/<img[^>]+src="([^"]+)"/i', $content, $m ) ) {
			return $m[1];
		}
	}
	$logo_id = get_theme_mod( 'custom_logo' ) ?: get_option( 'site_logo' );
	return $logo_id ? wp_get_attachment_image_url( $logo_id, 'large' ) : '';
}

add_action( 'wp_head', function () {
	if ( sitekit_seo_other_plugin_active() ) {
		return;
	}
	$title       = wp_get_document_title();
	$description = sitekit_seo_description();
	$image       = sitekit_seo_image();
	$url         = is_singular() ? get_permalink() : home_url( '/' );
	$tags        = array();
	if ( $description ) {
		$tags[] = sprintf( '<meta name="description" content="%s">', esc_attr( $description ) );
	}
	$tags[] = sprintf( '<meta property="og:type" content="%s">', is_front_page() ? 'website' : 'article' );
	$tags[] = sprintf( '<meta property="og:site_name" content="%s">', esc_attr( get_bloginfo( 'name' ) ) );
	$tags[] = sprintf( '<meta property="og:title" content="%s">', esc_attr( $title ) );
	if ( $description ) {
		$tags[] = sprintf( '<meta property="og:description" content="%s">', esc_attr( $description ) );
	}
	$tags[] = sprintf( '<meta property="og:url" content="%s">', esc_url( $url ) );
	$tags[] = sprintf( '<meta property="og:locale" content="%s">', esc_attr( str_replace( '-', '_', get_bloginfo( 'language' ) ) ) );
	if ( $image ) {
		$tags[] = sprintf( '<meta property="og:image" content="%s">', esc_url( $image ) );
	}
	$tags[] = sprintf( '<meta name="twitter:card" content="%s">', $image ? 'summary_large_image' : 'summary' );
	echo "\n<!-- SiteKit SEO -->\n" . implode( "\n", $tags ) . "\n";

	// LocalBusiness structured data, on the homepage only.
	$schema = get_option( 'sitekit_schema' );
	if ( is_front_page() && $schema ) {
		$data = json_decode( $schema, true );
		if ( is_array( $data ) ) {
			echo '<script type="application/ld+json">' . wp_json_encode( $data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG ) . "</script>\n";
		}
	}
}, 2 );

/*
 * Bilingual sites (English + Nepali). Each page stores its language (sitekit_lang: "en" or
 * "ne") and the address of the same page in the other language (sitekit_alt).
 */
function sitekit_seo_lang() {
	$lang = sitekit_seo_page_meta( 'sitekit_lang' );
	return in_array( $lang, array( 'en', 'ne' ), true ) ? $lang : '';
}

// <html lang="ne"> on Nepali pages, so browsers, screen readers and Google read them right.
add_filter( 'language_attributes', function ( $output ) {
	$lang = sitekit_seo_lang();
	if ( '' === $lang ) {
		return $output;
	}
	$code = 'ne' === $lang ? 'ne-NP' : 'en';
	$output = preg_replace( '/lang="[^"]*"/', 'lang="' . $code . '"', $output, 1, $count );
	return $count ? $output : $output . ' lang="' . $code . '"';
} );

// Body class for the theme CSS: shows the menu and buttons of the page's language.
add_filter( 'body_class', function ( $classes ) {
	$lang = sitekit_seo_lang();
	if ( '' !== $lang ) {
		$classes[] = 'sk-lang-' . $lang;
	}
	return $classes;
} );

// hreflang links (Google shows each visitor the right language), and the language switch
// in the header points at the same page in the other language.
add_action( 'wp_head', function () {
	$lang = sitekit_seo_lang();
	$alt  = sitekit_seo_page_meta( 'sitekit_alt' );
	if ( '' === $lang || '' === $alt ) {
		return;
	}
	$self  = get_permalink( get_queried_object_id() );
	$other = 'ne' === $lang ? 'en' : 'ne-NP';
	$mine  = 'ne' === $lang ? 'ne-NP' : 'en';
	printf( '<link rel="alternate" hreflang="%s" href="%s">' . "\n", esc_attr( $mine ), esc_url( $self ) );
	printf( '<link rel="alternate" hreflang="%s" href="%s">' . "\n", esc_attr( $other ), esc_url( $alt ) );
	if ( 'en' === $lang ) {
		printf( '<link rel="alternate" hreflang="x-default" href="%s">' . "\n", esc_url( $self ) );
	}
}, 2 );

add_action( 'wp_footer', function () {
	$alt = sitekit_seo_page_meta( 'sitekit_alt' );
	if ( '' === $alt ) {
		return;
	}
	echo '<script>document.querySelectorAll(".sk-langswitch").forEach(function(a){a.href=' . wp_json_encode( esc_url_raw( $alt ) ) . '})</script>' . "\n";
} );

