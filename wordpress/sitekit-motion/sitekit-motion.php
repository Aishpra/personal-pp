<?php
/**
 * Plugin Name: SiteKit Motion
 * Description: Lightweight animations for SiteKit sites: headline words rising in, numbers counting up, sections and cards revealing as you scroll, a parallax hero photo, a header that gains a shadow on scroll, page transitions, a back-to-top button, buttons that lean toward the pointer, a testimonial slider, a before/after photo slider, today's opening hours and a dark-mode switch. Powered by GSAP with ScrollTrigger and SplitText (bundled), with a lighter fallback if they fail to load. Everything is switched off for visitors who prefer reduced motion.
 * Version: 2.2.0
 * Requires at least: 6.2
 * Requires PHP: 7.4
 * License: GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'wp_enqueue_scripts', function () {
	if ( is_admin() ) {
		return;
	}
	$ver = '2.2.0';
	wp_register_style( 'sitekit-motion', false, array(), $ver );
	wp_enqueue_style( 'sitekit-motion' );
	wp_add_inline_style( 'sitekit-motion', file_get_contents( __DIR__ . '/motion.css' ) );
	// GSAP 3.15.1 (free "Standard" licence, see vendor/README.md), bundled so nothing loads from outside.
	$args = array( 'strategy' => 'defer', 'in_footer' => false );
	wp_enqueue_script( 'sitekit-gsap', plugins_url( 'vendor/gsap.min.js', __FILE__ ), array(), '3.15.1', $args );
	wp_enqueue_script( 'sitekit-gsap-scrolltrigger', plugins_url( 'vendor/ScrollTrigger.min.js', __FILE__ ), array( 'sitekit-gsap' ), '3.15.1', $args );
	wp_enqueue_script( 'sitekit-gsap-splittext', plugins_url( 'vendor/SplitText.min.js', __FILE__ ), array( 'sitekit-gsap' ), '3.15.1', $args );
	wp_enqueue_script( 'sitekit-motion', plugins_url( 'motion.js', __FILE__ ), array( 'sitekit-gsap', 'sitekit-gsap-scrolltrigger', 'sitekit-gsap-splittext' ), $ver, $args );
} );

// Marks the page as JavaScript-capable before anything paints, so content that will be
// revealed starts hidden instead of flashing in and out.
add_action( 'wp_head', function () {
	// Also starts the "curtain lifts" page transition when the visitor arrived by clicking a
	// link on the site (the click handler in motion.js leaves a flag in sessionStorage).
	echo "<script>(function(d){d.classList.add('sk-js');try{if(sessionStorage.getItem('sk-t')){sessionStorage.removeItem('sk-t');if(!matchMedia('(prefers-reduced-motion: reduce)').matches)d.classList.add('sk-enter')}}catch(e){}})(document.documentElement)</script>\n";
}, 1 );

// Applies the visitor's saved dark-mode choice before the page paints (no white flash).
// The key is per site, so sites sharing a domain (multisite) keep separate choices.
add_action( 'wp_head', function () {
	$key = 'sk-theme:' . home_url( '/' );
	echo '<script>window.skThemeKey=' . wp_json_encode( $key ) . ";try{if(localStorage.getItem(window.skThemeKey)==='dark')document.documentElement.classList.add('sk-dark')}catch(e){}</script>\n";
}, 1 );
