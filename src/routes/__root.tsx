import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import site from "@/lib/og/site.json";
import appCss from "../styles.css?url";

const APP_NAME = "CMdesk";
const base = import.meta.env.BASE_URL;

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: APP_NAME,
  url: site.url,
  description: site.description,
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Web",
  browserRequirements: "Requires JavaScript.",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
  author: { "@type": "Person", name: "MrFabio", url: "https://github.com/MrFabio" },
  keywords: "Championship Manager 01/02, CM 01/02, save viewer, save editor, .sav",
};

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: site.title },
      { name: "description", content: site.description },
      { name: "author", content: "MrFabio" },
      { name: "robots", content: "index, follow" },
      {
        name: "keywords",
        content: "CMdesk, Championship Manager 01/02, CM 01/02, CM save viewer, CM save editor, .sav viewer",
      },
      { name: "theme-color", content: "#e6dece" },
    ],
    links: [
      { rel: "canonical", href: site.url },
      { rel: "icon", type: "image/svg+xml", href: `${base}favicon.svg` },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  component: () => (
    <html lang="en" data-theme="broadsheet" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var r=localStorage.getItem("cmdesk-settings")||localStorage.getItem("savedesk-settings");if(r){var s=JSON.parse(r).state||{};if(s.pack)document.documentElement.dataset.pack=s.pack;if(s.theme)document.documentElement.dataset.theme=s.theme;}}catch(e){}',
          }}
        />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  ),
});
