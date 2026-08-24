"use strict";

/*
=====================================================
SERVICE WORKER DEL POS
=====================================================

Este Service Worker permite:

1. Abrir el POS sin Internet después de haberlo
   abierto al menos una vez con Internet.

2. Mantener index.html disponible offline.

3. Mantener las páginas del sistema disponibles
   offline.

4. Mantener disponible la librería de Supabase.

5. Actualizar automáticamente el caché cuando
   cambiemos la versión.

6. No interceptar ni guardar las peticiones
   de datos de Supabase.
=====================================================
*/

const CACHE_NAME =
  "pos-offline-v4";

const SUPABASE_SCRIPT =
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

const APP_FILES = [

  "./",

  "./index.html",

  "./dashboard.html",

  "./clientes.html",

  "./cuentas.html",

  "./historial.html",

  "./inventario.html",

  "./sw.js"

];

/*
=====================================================
INSTALACIÓN
=====================================================
*/

self.addEventListener(
  "install",
  event => {

    event.waitUntil(

      (async () => {

        const cache =
          await caches.open(
            CACHE_NAME
          );

        /*
          Primero guardamos el App Shell local.
        */

        await cache.addAll(
          APP_FILES
        );

        /*
          Intentamos guardar la librería de
          Supabase.

          Se utiliza no-cors porque es un recurso
          externo.
        */

        try{

          const response =
            await fetch(
              SUPABASE_SCRIPT,
              {
                mode:"no-cors",
                cache:"no-store"
              }
            );

          if(response){

            await cache.put(
              SUPABASE_SCRIPT,
              response
            );

          }

        }

        catch(error){

          console.warn(
            "No se pudo guardar Supabase en cache durante la instalación:",
            error
          );

        }

        /*
          Activamos inmediatamente la nueva versión.
        */

        await self.skipWaiting();

      })()

    );

  }
);

/*
=====================================================
ACTIVACIÓN
=====================================================
*/

self.addEventListener(
  "activate",
  event => {

    event.waitUntil(

      (async () => {

        const cacheNames =
          await caches.keys();

        await Promise.all(

          cacheNames
            .filter(
              name =>
                name !==
                CACHE_NAME
            )
            .map(
              name =>
                caches.delete(
                  name
                )
            )

        );

        await self.clients.claim();

      })()

    );

  }
);

/*
=====================================================
MENSAJES
=====================================================
*/

self.addEventListener(
  "message",
  event => {

    if(
      event.data &&
      event.data.type ===
      "SKIP_WAITING"
    ){

      self.skipWaiting();

    }

  }
);

/*
=====================================================
PETICIONES
=====================================================
*/

self.addEventListener(
  "fetch",
  event => {

    const request =
      event.request;

    /*
      Solo manejamos GET.
    */

    if(
      request.method !==
      "GET"
    ){

      return;

    }

    const url =
      new URL(
        request.url
      );

    /*
      -------------------------------------------------
      SUPABASE API
      -------------------------------------------------

      NO guardamos las peticiones de Supabase.

      Las ventas y los datos siguen manejándose
      desde index.html mediante localStorage.
    */

    if(
      url.hostname.endsWith(
        "supabase.co"
      )
    ){

      return;

    }

    /*
      -------------------------------------------------
      LIBRERÍA SUPABASE
      -------------------------------------------------
    */

    if(
      url.href.startsWith(
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
      )
    ){

      event.respondWith(

        caches.match(
          request
        )
        .then(
          cachedResponse => {

            if(cachedResponse){

              return cachedResponse;

            }

            return fetch(
              request
            )
            .then(
              networkResponse => {

                if(networkResponse){

                  const clone =
                    networkResponse.clone();

                  caches.open(
                    CACHE_NAME
                  )
                  .then(
                    cache => {

                      cache.put(
                        request,
                        clone
                      );

                    }
                  );

                }

                return networkResponse;

              }
            )
            .catch(
              () =>
                caches.match(
                  SUPABASE_SCRIPT
                )
            );

          }
        )

      );

      return;

    }

    /*
      -------------------------------------------------
      ARCHIVOS DEL MISMO DOMINIO
      -------------------------------------------------
    */

    if(
      url.origin ===
      self.location.origin
    ){

      /*
        Para navegación:

        Internet disponible:
        intentamos la página normal.

        Sin Internet:
        usamos index.html del caché.
      */

      if(
        request.mode ===
        "navigate"
      ){

        event.respondWith(

          fetch(
            request
          )
          .then(
            networkResponse => {

              if(
                networkResponse &&
                networkResponse.ok
              ){

                const clone =
                  networkResponse.clone();

                caches.open(
                  CACHE_NAME
                )
                .then(
                  cache => {

                    cache.put(
                      request,
                      clone
                    );

                    /*
                      También actualizamos
                      index.html cuando la
                      navegación corresponde
                      a la raíz.
                    */

                    if(
                      url.pathname ===
                        "/" ||
                      url.pathname.endsWith(
                        "/index.html"
                      )
                    ){

                      cache.put(
                        "./index.html",
                        networkResponse.clone()
                      );

                    }

                  }
                );

              }

              return networkResponse;

            }
          )
          .catch(
            async () => {

              const cachedPage =
                await caches.match(
                  request
                );

              if(cachedPage){

                return cachedPage;

              }

              const cachedIndex =
                await caches.match(
                  "./index.html"
                );

              if(cachedIndex){

                return cachedIndex;

              }

              return new Response(
                `
                <!DOCTYPE html>
                <html lang="es">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width,initial-scale=1">
                  <title>POS Offline</title>
                </head>
                <body style="font-family:Arial,sans-serif;padding:30px">
                  <h1>📴 POS sin conexión</h1>
                  <p>
                    No se encontró una copia offline de la aplicación.
                  </p>
                  <p>
                    Abre el POS una vez con Internet para preparar
                    el funcionamiento offline.
                  </p>
                </body>
                </html>
                `,
                {
                  status:200,
                  headers:{
                    "Content-Type":
                      "text/html;charset=UTF-8"
                  }
                }
              );

            }
          )

        );

        return;

      }

      /*
        Para CSS, JS, HTML, imágenes y demás
        recursos locales:

        1. Caché primero.
        2. Si no existe, Internet.
        3. Guardamos la respuesta.
      */

      event.respondWith(

        caches.match(
          request
        )
        .then(
          cachedResponse => {

            if(cachedResponse){

              return cachedResponse;

            }

            return fetch(
              request
            )
            .then(
              networkResponse => {

                if(
                  networkResponse &&
                  networkResponse.ok
                ){

                  const clone =
                    networkResponse.clone();

                  caches.open(
                    CACHE_NAME
                  )
                  .then(
                    cache => {

                      cache.put(
                        request,
                        clone
                      );

                    }
                  );

                }

                return networkResponse;

              }
            )
            .catch(
              () =>
                caches.match(
                  "./index.html"
                )
            );

          }
        )

      );

      return;

    }

    /*
      -------------------------------------------------
      OTROS RECURSOS EXTERNOS
      -------------------------------------------------

      No los almacenamos.
      Se solicitan normalmente.
    */

    return;

  }
);