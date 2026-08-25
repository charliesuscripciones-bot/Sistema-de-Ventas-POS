"use strict";

/*
=========================================================
 SISTEMA DE VENTAS POS
 SERVICE WORKER v8

 OBJETIVO:

 - Abrir el POS completamente offline.
 - Mantener index.html disponible offline.
 - Mantener Dashboard disponible offline.
 - Mantener Clientes disponible offline.
 - Mantener Cuentas disponible offline.
 - Mantener Historial disponible offline.
 - Mantener Inventario disponible offline.
 - Mantener la librería de Supabase disponible offline.
 - Mantener los recursos que ya fueron visitados.
 - Funcionar en GitHub Pages y Vercel.
=========================================================
*/


/* =========================================================
   VERSION
========================================================= */

const CACHE_NAME =
  "pos-cache-v8";


/* =========================================================
   LIBRERÍA SUPABASE

   ESTA ES LA PARTE IMPORTANTE PARA EL MODO OFFLINE.

   index.html actualmente carga:

   https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2

   Si este archivo no está en caché,
   index.html abre offline pero su JavaScript
   no puede ejecutarse.
========================================================= */

const SUPABASE_JS =
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";


/* =========================================================
   ARCHIVOS PRINCIPALES
========================================================= */

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

self.addEventListener(
  "install",
  event => {

    console.log(
      "[POS SW v8] Instalando..."
    );


    event.waitUntil(

      (async () => {

        const cache =
          await caches.open(
            CACHE_NAME
          );


        /*
        -----------------------------------------------------
        CACHEAR ARCHIVOS DEL SISTEMA
        -----------------------------------------------------
        */

        for(
          const file of APP_SHELL
        ){

          try{

            const response =
              await fetch(
                file,
                {
                  cache:"no-store"
                }
              );


            if(
              response &&
              response.ok
            ){

              await cache.put(
                file,
                response.clone()
              );


              console.log(
                "[POS SW v8] Cacheado:",
                file
              );

            }

          }

          catch(error){

            console.warn(
              "[POS SW v8] No se pudo cachear:",
              file,
              error
            );

          }

        }


        /*
        -----------------------------------------------------
        CACHEAR SUPABASE JS
        -----------------------------------------------------
        */

        try{

          const request =
            new Request(
              SUPABASE_JS,
              {
                method:"GET",
                mode:"cors",
                cache:"no-store"
              }
            );


          const response =
            await fetch(
              request
            );


          if(
            response &&
            response.ok
          ){

            await cache.put(
              SUPABASE_JS,
              response.clone()
            );


            console.log(
              "[POS SW v8] Supabase JS guardado offline."
            );

          }

          else{

            console.warn(
              "[POS SW v8] Supabase JS respondió:",
              response?.status
            );

          }

        }

        catch(error){

          console.warn(
            "[POS SW v8] No se pudo guardar Supabase JS:",
            error
          );

        }


        /*
        -----------------------------------------------------
        ACTIVAR INMEDIATAMENTE
        -----------------------------------------------------
        */

        await self.skipWaiting();

      })()

    );

  }
);


/* =========================================================
   ACTIVATE
========================================================= */

self.addEventListener(
  "activate",
  event => {

    console.log(
      "[POS SW v8] Activando..."
    );


    event.waitUntil(

      (async () => {

        const cacheNames =
          await caches.keys();


        for(
          const cacheName of cacheNames
        ){

          if(
            cacheName.startsWith(
              "pos-cache-"
            ) &&
            cacheName !==
              CACHE_NAME
          ){

            console.log(
              "[POS SW v8] Eliminando caché anterior:",
              cacheName
            );


            await caches.delete(
              cacheName
            );

          }

        }


        /*
        -----------------------------------------------------
        TOMAR CONTROL DE LAS PÁGINAS ABIERTAS
        -----------------------------------------------------
        */

        await self.clients.claim();

      })()

    );

  }
);


/* =========================================================
   FETCH
========================================================= */

self.addEventListener(
  "fetch",
  event => {

    const request =
      event.request;


    /*
    -----------------------------------------------------
    SOLO GET
    -----------------------------------------------------
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
    -----------------------------------------------------
    SUPABASE API

    NO intentamos almacenar respuestas de Supabase
    aquí.

    Los datos offline los administra index.html
    mediante su caché local.
    -----------------------------------------------------
    */

    if(
      url.hostname.includes(
        "supabase.co"
      )
    ){

      return;

    }


    /*
    -----------------------------------------------------
    SUPABASE JS / CDN

    ESTA PARTE ES FUNDAMENTAL.

    Si estamos offline y index.html intenta cargar:

    https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2

    devolvemos la copia almacenada.
    -----------------------------------------------------
    */

    if(
      url.href ===
      SUPABASE_JS ||
      (
        url.hostname ===
        "cdn.jsdelivr.net" &&
        url.pathname.includes(
          "/@supabase/supabase-js"
        )
      )
    ){

      event.respondWith(

        caches.match(
          SUPABASE_JS
        )

        .then(
          cachedResponse => {

            if(
              cachedResponse
            ){

              console.log(
                "[POS SW v8] Supabase JS desde caché."
              );


              /*
              Intentamos actualizar en segundo plano
              cuando exista Internet.
              */

              updateSupabaseCache();


              return cachedResponse;

            }


            /*
            Si todavía no existe en caché,
            intentamos Internet.
            */

            return fetch(
              request
            )

            .then(
              response => {

                if(
                  response &&
                  response.ok
                ){

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
            )

            .catch(
              () => {

                return new Response(
                  "Supabase JS no está disponible offline.",
                  {
                    status:503,
                    statusText:"Offline"
                  }
                );

              }
            );

          }
        )

      );


      return;

    }


    /*
    -----------------------------------------------------
    ARCHIVOS DEL SISTEMA / NAVEGACIÓN
    -----------------------------------------------------
    */

    if(
      request.mode ===
        "navigate" ||
      request.destination ===
        "document"
    ){

      event.respondWith(

        handleNavigation(
          request
        )

      );


      return;

    }


    /*
    -----------------------------------------------------
    OTROS RECURSOS
    -----------------------------------------------------
    */

    event.respondWith(

      caches.match(
        request
      )

      .then(
        cachedResponse => {

          if(
            cachedResponse
          ){

            return cachedResponse;

          }


          return fetch(
            request
          )

          .then(
            response => {

              /*
              Guardamos recursos válidos.
              */

              if(
                response &&
                response.status === 200
              ){

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
          )

          .catch(
            () => {

              return new Response(
                "",
                {
                  status:503,
                  statusText:"Offline"
                }
              );

            }
          );

        }
      )

    );

  }
);


/* =========================================================
   NAVEGACIÓN OFFLINE
========================================================= */

async function handleNavigation(
  request
){

  /*
  -------------------------------------------------------
  1. PRIMERO BUSCAMOS LA PÁGINA EXACTA
  -------------------------------------------------------
  */

  const cached =
    await caches.match(
      request
    );


  if(
    cached
  ){

    /*
    Actualización en segundo plano
    cuando haya Internet.
    */

    updatePageCache(
      request
    );


    return cached;

  }


  /*
  -------------------------------------------------------
  2. INTENTAR INTERNET
  -------------------------------------------------------
  */

  try{

    const response =
      await fetch(
        request
      );


    if(
      response &&
      response.ok
    ){

      const cache =
        await caches.open(
          CACHE_NAME
        );


      await cache.put(
        request,
        response.clone()
      );

    }


    return response;

  }

  catch(error){

    console.warn(
      "[POS SW v8] Navegación offline:",
      request.url
    );


    /*
    -----------------------------------------------------
    3. SI NO EXISTE LA RUTA,
       USAR index.html
    -----------------------------------------------------
    */

    const fallback =
      await caches.match(
        "./index.html"
      );


    if(
      fallback
    ){

      return fallback;

    }


    /*
    -----------------------------------------------------
    4. ÚLTIMO RECURSO
    -----------------------------------------------------
    */

    return new Response(
      `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport"
              content="width=device-width,initial-scale=1">
        <title>Sistema POS</title>
      </head>

      <body
        style="
          font-family:-apple-system,BlinkMacSystemFont,
          sans-serif;
          padding:30px;
          text-align:center;
        "
      >

        <h1>🧾 Sistema POS</h1>

        <p>
          No hay conexión a Internet y esta página
          todavía no ha sido almacenada en el dispositivo.
        </p>

      </body>
      </html>
      `,
      {
        status:503,
        statusText:"Offline",
        headers:{
          "Content-Type":
            "text/html;charset=UTF-8"
        }
      }
    );

  }

}


/* =========================================================
   ACTUALIZAR PÁGINA EN SEGUNDO PLANO
========================================================= */

function updatePageCache(
  request
){

  fetch(
    request
  )

  .then(
    response => {

      if(
        !response ||
        !response.ok
      ){

        return;

      }


      return caches.open(
        CACHE_NAME
      )

      .then(
        cache => {

          return cache.put(
            request,
            response
          );

        }
      );

    }
  )

  .catch(
    () => {

      /*
      Sin Internet:

      no hacemos nada.

      La copia existente permanece.
      */

    }
  );

}


/* =========================================================
   ACTUALIZAR SUPABASE JS
========================================================= */

function updateSupabaseCache(){

  fetch(
    new Request(
      SUPABASE_JS,
      {
        method:"GET",
        mode:"cors",
        cache:"no-store"
      }
    )
  )

  .then(
    response => {

      if(
        !response ||
        !response.ok
      ){

        return;

      }


      return caches.open(
        CACHE_NAME
      )

      .then(
        cache => {

          return cache.put(
            SUPABASE_JS,
            response
          );

        }
      );

    }
  )

  .catch(
    () => {

      /*
      Sin Internet:

      mantenemos la copia existente.
      */

    }
  );

}


/* =========================================================
   MESSAGE
========================================================= */

self.addEventListener(
  "message",
  event => {

    /*
    Aceptamos ambas formas:

    "SKIP_WAITING"

    y

    {
      type:"SKIP_WAITING"
    }
    */

    if(
      event.data ===
      "SKIP_WAITING"
    ){

      self.skipWaiting();

      return;

    }


    if(
      event.data &&
      event.data.type ===
      "SKIP_WAITING"
    ){

      self.skipWaiting();

    }

  }
);


/* =========================================================
   ERROR
========================================================= */

self.addEventListener(
  "error",
  event => {

    console.error(
      "[POS SW v8] Error:",
      event.error ||
      event.message
    );

  }
);


/* =========================================================
   UNHANDLED REJECTION
========================================================= */

self.addEventListener(
  "unhandledrejection",
  event => {

    console.error(
      "[POS SW v8] Promise rechazada:",
      event.reason
    );

  }
);