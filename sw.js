"use strict";

/*
=========================================================
 SISTEMA DE VENTAS POS
 SERVICE WORKER v9

 CAMBIO PRINCIPAL:

 ONLINE:
   Siempre intenta obtener primero la versión actual
   desde GitHub Pages.

 OFFLINE:
   Utiliza la versión almacenada en caché.

 Esto evita que una versión vieja de index.html
 siga apareciendo aunque GitHub ya tenga una versión nueva.
=========================================================
*/

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
   INSTALL
========================================================= */

self.addEventListener("install", event => {

  console.log("[POS SW v9] Instalando...");

  event.waitUntil(

    (async () => {

      const cache =
        await caches.open(CACHE_NAME);

      /*
       * Guardamos las páginas principales.
       */

      for (const file of APP_SHELL) {

        try {

          const response =
            await fetch(
              new Request(
                file,
                {
                  cache: "no-store"
                }
              )
            );

          if (response && response.ok) {

            await cache.put(
              file,
              response.clone()
            );

            console.log(
              "[POS SW v9] Cacheado:",
              file
            );

          }

        }

        catch (error) {

          console.warn(
            "[POS SW v9] No se pudo cachear:",
            file,
            error
          );

        }

      }


      /*
       * Guardamos Supabase JS.
       */

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

        if (
          response &&
          response.ok
        ) {

          await cache.put(
            SUPABASE_JS,
            response.clone()
          );

          console.log(
            "[POS SW v9] Supabase JS guardado."
          );

        }

      }

      catch (error) {

        console.warn(
          "[POS SW v9] No se pudo guardar Supabase:",
          error
        );

      }


      /*
       * Activación inmediata.
       */

      await self.skipWaiting();

    })()

  );

});


/* =========================================================
   ACTIVATE
========================================================= */

self.addEventListener("activate", event => {

  console.log("[POS SW v9] Activando...");

  event.waitUntil(

    (async () => {

      const cacheNames =
        await caches.keys();

      /*
       * Eliminamos TODAS las versiones anteriores
       * del POS.
       */

      for (const cacheName of cacheNames) {

        if (
          cacheName.startsWith("pos-cache-") &&
          cacheName !== CACHE_NAME
        ) {

          console.log(
            "[POS SW v9] Eliminando caché:",
            cacheName
          );

          await caches.delete(
            cacheName
          );

        }

      }

      /*
       * Tomamos control inmediatamente.
       */

      await self.clients.claim();

      console.log(
        "[POS SW v9] Control tomado."
      );

    })()

  );

});


/* =========================================================
   FETCH
========================================================= */

self.addEventListener("fetch", event => {

  const request =
    event.request;


  /*
   * Solo GET.
   */

  if (
    request.method !== "GET"
  ) {

    return;

  }


  const url =
    new URL(request.url);


  /*
   * -------------------------------------------------------
   * SUPABASE API
   *
   * No cacheamos las llamadas a la API.
   * -------------------------------------------------------
   */

  if (
    url.hostname.includes("supabase.co")
  ) {

    return;

  }


  /*
   * -------------------------------------------------------
   * SUPABASE JAVASCRIPT
   * -------------------------------------------------------
   */

  if (
    url.hostname === "cdn.jsdelivr.net" &&
    url.pathname.includes(
      "/@supabase/supabase-js"
    )
  ) {

    event.respondWith(
      handleSupabase(request)
    );

    return;

  }


  /*
   * -------------------------------------------------------
   * PÁGINAS HTML
   *
   * ESTA ES LA CORRECCIÓN MÁS IMPORTANTE.
   *
   * ONLINE:
   *   network first
   *
   * OFFLINE:
   *   cache
   * -------------------------------------------------------
   */

  if (
    request.mode === "navigate" ||
    request.destination === "document"
  ) {

    event.respondWith(
      handleNavigation(request)
    );

    return;

  }


  /*
   * -------------------------------------------------------
   * OTROS RECURSOS
   *
   * Primero caché, después Internet.
   * -------------------------------------------------------
   */

  event.respondWith(

    caches.match(request)

      .then(cached => {

        if (cached) {

          /*
           * Actualización en segundo plano.
           */

          refreshResource(
            request
          );

          return cached;

        }


        return fetch(request)

          .then(response => {

            if (
              response &&
              response.status === 200
            ) {

              caches.open(
                CACHE_NAME
              )
              .then(cache => {

                cache.put(
                  request,
                  response.clone()
                );

              });

            }

            return response;

          })

          .catch(() => {

            return new Response(
              "",
              {
                status: 503,
                statusText: "Offline"
              }
            );

          });

      })

  );

});


/* =========================================================
   NAVEGACIÓN
========================================================= */

async function handleNavigation(
  request
) {

  /*
   * =======================================================
   * 1. INTERNET PRIMERO
   * =======================================================
   *
   * Esto obliga al POS a intentar obtener el index.html
   * actual de GitHub Pages.
   */

  try {

    const response =
      await fetch(
        new Request(
          request,
          {
            cache: "no-store"
          }
        )
      );


    if (
      response &&
      response.ok
    ) {

      const cache =
        await caches.open(
          CACHE_NAME
        );


      /*
       * Guardamos la versión nueva.
       */

      await cache.put(
        request,
        response.clone()
      );


      /*
       * También actualizamos explícitamente
       * index.html para evitar discrepancias
       * entre "/" y "./index.html".
       */

      const url =
        new URL(request.url);

      if (
        url.pathname.endsWith("/") ||
        url.pathname.endsWith("index.html")
      ) {

        await cache.put(
          "./index.html",
          response.clone()
        );

      }


      console.log(
        "[POS SW v9] Página actualizada:",
        request.url
      );


      return response;

    }

  }

  catch (error) {

    console.warn(
      "[POS SW v9] Internet no disponible:",
      error
    );

  }


  /*
   * =======================================================
   * 2. SI NO HAY INTERNET → CACHÉ
   * =======================================================
   */

  const exactCache =
    await caches.match(
      request
    );


  if (exactCache) {

    console.log(
      "[POS SW v9] Página desde caché:",
      request.url
    );

    return exactCache;

  }


  /*
   * =======================================================
   * 3. FALLBACK → INDEX
   * =======================================================
   */

  const indexCache =
    await caches.match(
      "./index.html"
    );


  if (indexCache) {

    console.log(
      "[POS SW v9] Fallback a index.html"
    );

    return indexCache;

  }


  /*
   * =======================================================
   * 4. ÚLTIMO RECURSO
   * =======================================================
   */

  return new Response(

    `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta
        name="viewport"
        content="width=device-width,initial-scale=1"
      >
      <title>Sistema POS</title>
    </head>

    <body
      style="
        font-family:-apple-system,BlinkMacSystemFont,sans-serif;
        padding:30px;
        text-align:center;
      "
    >

      <h1>🧾 Sistema POS</h1>

      <p>
        No hay conexión a Internet y esta página
        todavía no está disponible sin conexión.
      </p>

    </body>
    </html>
    `,

    {
      status: 503,
      statusText: "Offline",
      headers: {
        "Content-Type":
          "text/html;charset=UTF-8"
      }
    }

  );

}


/* =========================================================
   SUPABASE
========================================================= */

async function handleSupabase(
  request
) {

  /*
   * Intentamos Internet primero.
   */

  try {

    const response =
      await fetch(
        new Request(
          request,
          {
            cache: "no-store"
          }
        )
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
        SUPABASE_JS,
        response.clone()
      );

      return response;

    }

  }

  catch (error) {

    console.warn(
      "[POS SW v9] Supabase offline."
    );

  }


  /*
   * Sin Internet → caché.
   */

  const cached =
    await caches.match(
      SUPABASE_JS
    );


  if (cached) {

    return cached;

  }


  return new Response(
    "Supabase JS no está disponible offline.",
    {
      status: 503,
      statusText: "Offline",
      headers: {
        "Content-Type":
          "text/plain;charset=UTF-8"
      }
    }
  );

}


/* =========================================================
   ACTUALIZAR RECURSOS
========================================================= */

function refreshResource(
  request
) {

  fetch(
    new Request(
      request,
      {
        cache: "no-store"
      }
    )
  )

  .then(response => {

    if (
      !response ||
      !response.ok
    ) {

      return;

    }


    return caches.open(
      CACHE_NAME
    )

    .then(cache => {

      return cache.put(
        request,
        response
      );

    });

  })

  .catch(() => {

    /*
     * Sin Internet no hacemos nada.
     */

  });

}


/* =========================================================
   MESSAGE
========================================================= */

self.addEventListener(
  "message",
  event => {

    if (
      event.data ===
      "SKIP_WAITING"
    ) {

      self.skipWaiting();

      return;

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


/* =========================================================
   ERRORES
========================================================= */

self.addEventListener(
  "error",
  event => {

    console.error(
      "[POS SW v9] Error:",
      event.error ||
      event.message
    );

  }
);


self.addEventListener(
  "unhandledrejection",
  event => {

    console.error(
      "[POS SW v9] Promise rechazada:",
      event.reason
    );

  }
);