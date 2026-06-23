/**
 * Third Party Scripts Component
 * 
 * Optimized loading of third-party scripts
 * - Delayed loading to prioritize critical resources
 * - Strategic placement to minimize blocking
 */

import Script from 'next/script';

/**
 * Google Analytics
 * Loads after page is interactive
 */
export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  if (!measurementId || process.env.NODE_ENV !== 'production') {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}', {
            page_path: window.location.pathname,
          });
        `}
      </Script>
    </>
  );
}

/**
 * Google Tag Manager
 * Loads after page is interactive
 */
export function GoogleTagManager({ gtmId }: { gtmId: string }) {
  if (!gtmId || process.env.NODE_ENV !== 'production') {
    return null;
  }

  return (
    <>
      <Script id="google-tag-manager" strategy="afterInteractive">
        {`
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${gtmId}');
        `}
      </Script>
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
          height="0"
          width="0"
          style={{ display: 'none', visibility: 'hidden' }}
        />
      </noscript>
    </>
  );
}

/**
 * Facebook Pixel
 * Loads lazily after page is interactive
 */
export function FacebookPixel({ pixelId }: { pixelId: string }) {
  if (!pixelId || process.env.NODE_ENV !== 'production') {
    return null;
  }

  return (
    <Script id="facebook-pixel" strategy="lazyOnload">
      {`
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${pixelId}');
        fbq('track', 'PageView');
      `}
    </Script>
  );
}

/**
 * Hotjar Analytics
 * Loads lazily after page is fully loaded
 */
export function Hotjar({ hjid, hjsv }: { hjid: string; hjsv: string }) {
  if (!hjid || process.env.NODE_ENV !== 'production') {
    return null;
  }

  return (
    <Script id="hotjar" strategy="lazyOnload">
      {`
        (function(h,o,t,j,a,r){
          h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
          h._hjSettings={hjid:${hjid},hjsv:${hjsv}};
          a=o.getElementsByTagName('head')[0];
          r=o.createElement('script');r.async=1;
          r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
          a.appendChild(r);
        })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
      `}
    </Script>
  );
}

/**
 * Intercom Chat
 * Loads lazily when user is likely to interact
 */
export function Intercom({ appId }: { appId: string }) {
  if (!appId || process.env.NODE_ENV !== 'production') {
    return null;
  }

  return (
    <Script id="intercom" strategy="lazyOnload">
      {`
        (function(){var w=window;var ic=w.Intercom;if(typeof ic==="function"){
          ic('reattach_activator');ic('update',w.intercomSettings);
        }else{var d=document;var i=function(){i.c(arguments);};i.q=[];
        i.c=function(args){i.q.push(args);};w.Intercom=i;var l=function(){
          var s=d.createElement('script');s.type='text/javascript';s.async=true;
          s.src='https://widget.intercom.io/widget/${appId}';
          var x=d.getElementsByTagName('script')[0];x.parentNode.insertBefore(s,x);
        };if(document.readyState==='complete'){l();}
        else if(w.attachEvent){w.attachEvent('onload',l);}
        else{w.addEventListener('load',l,false);}}})();
        window.Intercom('boot', { app_id: '${appId}' });
      `}
    </Script>
  );
}

/**
 * Crisp Chat
 * Loads lazily when user is likely to interact
 */
export function CrispChat({ websiteId }: { websiteId: string }) {
  if (!websiteId || process.env.NODE_ENV !== 'production') {
    return null;
  }

  return (
    <Script id="crisp-chat" strategy="lazyOnload">
      {`
        window.$crisp=[];window.CRISP_WEBSITE_ID="${websiteId}";
        (function(){d=document;s=d.createElement("script");
        s.src="https://client.crisp.chat/l.js";s.async=1;
        d.getElementsByTagName("head")[0].appendChild(s);})();
      `}
    </Script>
  );
}

/**
 * Stripe
 * Only loads when needed (on checkout page)
 */
export function StripeScript() {
  return (
    <Script
      src="https://js.stripe.com/v3/"
      strategy="lazyOnload"
    />
  );
}

/**
 * PayPal
 * Only loads when needed (on checkout page)
 */
export function PayPalScript({ clientId }: { clientId: string }) {
  if (!clientId) return null;

  return (
    <Script
      src={`https://www.paypal.com/sdk/js?client-id=${clientId}`}
      strategy="lazyOnload"
    />
  );
}

/**
 * reCAPTCHA
 * Loads when forms are visible
 */
export function ReCaptcha({ siteKey }: { siteKey: string }) {
  if (!siteKey) return null;

  return (
    <Script
      src={`https://www.google.com/recaptcha/api.js?render=${siteKey}`}
      strategy="lazyOnload"
    />
  );
}

/**
 * All Third Party Scripts Combined
 * Use this in your root layout with environment variables
 */
export function ThirdPartyScripts() {
  const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;
  const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID;
  const HOTJAR_ID = process.env.NEXT_PUBLIC_HOTJAR_ID;
  const HOTJAR_SV = process.env.NEXT_PUBLIC_HOTJAR_SV;

  return (
    <>
      {GA_MEASUREMENT_ID && <GoogleAnalytics measurementId={GA_MEASUREMENT_ID} />}
      {GTM_ID && <GoogleTagManager gtmId={GTM_ID} />}
      {FB_PIXEL_ID && <FacebookPixel pixelId={FB_PIXEL_ID} />}
      {HOTJAR_ID && HOTJAR_SV && <Hotjar hjid={HOTJAR_ID} hjsv={HOTJAR_SV} />}
    </>
  );
}

/**
 * Partytown Web Worker Scripts (Advanced)
 * For even better performance, run scripts in a web worker
 * Requires @builder.io/partytown installation
 */
export function PartytownScripts() {
  return (
    <>
      {/* Add Partytown configuration here if using */}
      {/* <Script
        data-partytown-config
        dangerouslySetInnerHTML={{
          __html: `
            partytown = {
              lib: "/_next/static/~partytown/",
              forward: ["dataLayer.push", "gtag", "fbq", "hj"]
            };
          `,
        }}
      /> */}
    </>
  );
}
