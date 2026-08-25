"use strict";

const CACHE_NAME = "pos-cache-v9";

const SUPABASE_JS =
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

const APP_SHELL = [
  "./",
  "./index.html",
  "./dashboard.html",
  "./clientes.html",
  "./cuentas.html",
  "./historial.html",
  "./inventario.html",
  "./sw.js"
];

/* =========================================================
   INSTALACIÓN
========================================================= */

self.addEventListener("install", event => {

  event.waitUntil(

    (async () => {

      const cache =
        await caches.open(CACHE_NAME);

      for (const file of APP_SHELL) {

        try {

          const response =
            await fetch(
              file,
              {
                cache: "no-store"
              }
            );

          if (response && response.ok) {

            await cache.put(
              file,
              response.clone()
            );

          }

        } catch (error) {

          console.warn(
            "[POS v9] No se pudo guardar:",
            file,
            error
          );

        }

      }

      /* Supabase */

      try {

        const response =
          await fetch(
            new Request(
              SUPABASE_JS,
              {
                method: "GET",
                mode: "cors",
                cache: "no-store"
              }
            )
          );

        if (response && response.ok) {

          await cache.put(
            SUPABASE_JS,
            response.clone()
          );

        }

      } catch (error) {

        console.warn(
          "[POS v9] Supabase JS no disponible:",
          error
        );

      }

      await self.skipWaiting();

    })()

  );

});


/* =========================================================
   ACTIVACIÓN
========================================================= */

self.addEventListener("activate", event => {

  event.waitUntil(

    (async () => {

      const cacheNames =
        await caches.keys();

      await Promise.all(

        cacheNames
          .filter(
            name =>
              name.startsWith("pos-cache-") &&
              name !== CACHE_NAME
          )
          .map(
            name =>
              caches.delete(name)
          )

      );

      await self.clients.claim();

    })()

  );

});


/* =========================================================
   FETCH
========================================================= */

self.addEventListener("fetch", event => {

  const request =
    event.request;

  if (
    request.method !== "GET"
  ) {
    return;
  }

  const url =
    new URL(request.url);


  /* -------------------------------------------------------
     SUPABASE API
  ------------------------------------------------------- */

  if (
    url.hostname.includes("supabase.co")
  ) {

    return;

  }


  /* -------------------------------------------------------
     SUPABASE JS
  ------------------------------------------------------- */

  if (
    url.hostname === "cdn.jsdelivr.net" &&
    url.pathname.includes(
      "/@supabase/supabase-js"
    )
  ) {

    event.respondWith(

      caches.match(
        SUPABASE_JS
      )

      .then(
        cached => {

          if (cached) {

            return cached;

          }

          return fetch(request)

            .then(
              response => {

                if (
                  response &&
                  response.ok
                ) {

                  caches.open(
                    CACHE_NAME
                  )

                  .then(
                    cache => {

                      cache.put(
                        SUPABASE_JS,
                        response.clone()
                      );

                    }
                  );

                }

                return response;

              }
            );

        }
      )

    );

    return;

  }


  /* -------------------------------------------------------
     DOCUMENTOS / HTML

     IMPORTANTE:

     ANTES:
     CACHE FIRST

     AHORA:
     NETWORK FIRST

     Esto evita que el navegador siga mostrando
     una versión vieja de index.html.
  ------------------------------------------------------- */

  if (
    request.mode === "navigate" ||
    request.destination === "document"
  ) {

    event.respondWith(
      networkFirstDocument(request)
    );

    return;

  }


  /* -------------------------------------------------------
     OTROS RECURSOS
  ------------------------------------------------------- */

  event.respondWith(

    caches.match(request)

      .then(
        cached => {

          if (cached) {

            return cached;

          }

          return fetch(request)

            .then(
              response => {

                if (
                  response &&
                  response.status === 200
                ) {

                  caches.open(
                    CACHE_NAME
                  )

                  .then(
                    cache => {

                      cache.put(
                        request,
                        response.clone()
                      );

                    }
                  );

                }

                return response;

              }
            );

        }
      )

  );

});


/* =========================================================
   NETWORK FIRST PARA HTML
========================================================= */

async function networkFirstDocument(
  request
) {

  try {

    /*
     * SI HAY INTERNET:
     * SIEMPRE OBTENER LA VERSIÓN ACTUAL
     */

    const response =
      await fetch(
        request,
        {
          cache: "no-store"
        }
      );

    if (
      response &&
      response.ok
    ) {

      const cache =
        await caches.open(
          CACHE_NAME
        );

      await cache.put(
        request,
        response.clone()
      );


      /*
       * Guardamos también index.html
       * para uso offline.
       */

      const pathname =
        new URL(
          request.url
        ).pathname;

      if (
        pathname.endsWith("/") ||
        pathname.endsWith("/index.html")
      ) {

        await cache.put(
          "./index.html",
          response.clone()
        );

        await cache.put(
          "./",
          response.clone()
        );

      }

    }

    return response;

  }

  catch (error) {

    /*
     * SIN INTERNET:
     * usar la copia guardada.
     */

    const cached =
      await caches.match(
        request
      );

    if (cached) {

      return cached;

    }


    /*
     * Último recurso:
     * index.html
     */

    const fallback =
      await caches.match(
        "./index.html"
      );

    if (fallback) {

      return fallback;

    }


    return new Response(

      "No hay conexión y esta página todavía no está disponible offline.",

      {
        status: 503,

        headers: {
          "Content-Type":
            "text/plain;charset=UTF-8"
        }

      }

    );

  }

}


/* =========================================================
   ACTUALIZACIÓN INMEDIATA
========================================================= */

self.addEventListener(
  "message",
  event => {

    if (
      event.data ===
      "SKIP_WAITING"
    ) {

      self.skipWaiting();

    }

    if (
      event.data &&
      event.data.type ===
      "SKIP_WAITING"
    ) {

      self.skipWaiting();

    }

  }
);