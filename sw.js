"use strict";

/*
=====================================================
SERVICE WORKER DEL SISTEMA DE VENTAS POS
=====================================================

Objetivos:

1. Permitir abrir el POS después de haberlo
   visitado al menos una vez con Internet.

2. Cuando HAY Internet:
   - Preferir la versión actual de la página.
   - Actualizar el caché automáticamente.

3. Cuando NO HAY Internet:
   - Usar la copia guardada.
   - Permitir que index.html abra normalmente.

4. Mantener disponibles:
   - index.html
   - páginas del sistema
   - Supabase JS

5. NO interceptar las consultas de datos
   de Supabase.

=====================================================
*/

const CACHE_NAME =
  "pos-offline-v6";

const SUPABASE_SCRIPT =
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

const APP_FILES = [

  "./",

  "./index.html",

  "./clientes.html",

  "./cuentas.html",

  "./historial.html",

  "./inventario.html",

  "./dashboard.html",

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
          Guardamos los archivos principales.
        */

        for(
          const file of APP_FILES
        ){

          try{

            await cache.add(
              file
            );

          }

          catch(error){

            console.warn(
              "No se pudo guardar:",
              file,
              error
            );

          }

        }

        /*
          Guardamos la librería de Supabase.

          Se utiliza no-cors porque viene de
          jsDelivr.
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
            "No se pudo guardar Supabase:",
            error
          );

        }

        /*
          Activamos inmediatamente.
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

        const names =
          await caches.keys();

        await Promise.all(

          names
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
FETCH
=====================================================
*/

self.addEventListener(
  "fetch",
  event => {

    const request =
      event.request;

    /*
      Solo GET.
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
    =================================================
    SUPABASE API
    =================================================

    No interceptamos las consultas a Supabase.

    Esto es MUY importante porque las consultas
    deben ir directamente a Supabase cuando
    existe Internet.
    */

    if(
      url.hostname.endsWith(
        ".supabase.co"
      )
    ){

      return;

    }

    /*
    =================================================
    SUPABASE JS
    =================================================
    */

    if(
      url.href.startsWith(
        SUPABASE_SCRIPT
      )
    ){

      event.respondWith(

        (async () => {

          /*
            Primero intentamos Internet.
          */

          try{

            const networkResponse =
              await fetch(
                request
              );

            if(
              networkResponse &&
              networkResponse.ok
            ){

              const clone =
                networkResponse.clone();

              const cache =
                await caches.open(
                  CACHE_NAME
                );

              await cache.put(
                request,
                clone
              );

            }

            return networkResponse;

          }

          catch(error){

            /*
              Sin Internet usamos la copia.
            */

            const cached =
              await caches.match(
                request
              );

            if(cached){

              return cached;

            }

            const cachedScript =
              await caches.match(
                SUPABASE_SCRIPT
              );

            if(cachedScript){

              return cachedScript;

            }

            throw error;

          }

        })()

      );

      return;

    }

    /*
    =================================================
    NAVEGACIÓN
    =================================================

    Cuando el usuario abre o recarga el POS:

    1. Internet:
       obtener versión actual.

    2. Sin Internet:
       utilizar caché.
    */

    if(
      request.mode ===
      "navigate"
    ){

      event.respondWith(

        (async () => {

          try{

            const networkResponse =
              await fetch(
                request,
                {
                  cache:"no-store"
                }
              );

            if(
              networkResponse &&
              networkResponse.ok
            ){

              const cache =
                await caches.open(
                  CACHE_NAME
                );

              /*
                Guardamos la navegación actual.
              */

              await cache.put(
                request,
                networkResponse.clone()
              );

              /*
                Si estamos en index,
                actualizamos también la copia
                principal.
              */

              if(
                url.pathname === "/" ||
                url.pathname.endsWith(
                  "/index.html"
                )
              ){

                await cache.put(
                  "./index.html",
                  networkResponse.clone()
                );

              }

            }

            return networkResponse;

          }

          catch(error){

            /*
              Sin Internet.

              Primero buscamos exactamente
              la URL solicitada.
            */

            const cachedPage =
              await caches.match(
                request
              );

            if(cachedPage){

              return cachedPage;

            }

            /*
              Después intentamos index.html.
            */

            const cachedIndex =
              await caches.match(
                "./index.html"
              );

            if(cachedIndex){

              return cachedIndex;

            }

            /*
              Último recurso.
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

<title>POS Offline</title>

</head>

<body
style="
font-family:Arial,sans-serif;
padding:30px;
">

<h1>
📴 POS sin conexión
</h1>

<p>
No se encontró una copia offline de la aplicación.
</p>

<p>
Abre el POS al menos una vez con Internet para
prepararlo para trabajar sin conexión.
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

        })()

      );

      return;

    }

    /*
    =================================================
    RECURSOS LOCALES
    =================================================

    CSS, JS, imágenes, HTML, etc.

    Estrategia:

    1. Si existe Internet:
       usar la versión nueva y actualizar caché.

    2. Si falla:
       usar caché.
    */

    if(
      url.origin ===
      self.location.origin
    ){

      event.respondWith(

        (async () => {

          try{

            const networkResponse =
              await fetch(
                request
              );

            if(
              networkResponse &&
              networkResponse.ok
            ){

              const cache =
                await caches.open(
                  CACHE_NAME
                );

              await cache.put(
                request,
                networkResponse.clone()
              );

            }

            return networkResponse;

          }

          catch(error){

            const cached =
              await caches.match(
                request
              );

            if(cached){

              return cached;

            }

            /*
              Para recursos que no existen
              en caché no devolvemos index.html,
              porque eso puede provocar errores
              en JavaScript/CSS.
            */

            throw error;

          }

        })()

      );

      return;

    }

    /*
    =================================================
    OTROS RECURSOS EXTERNOS
    =================================================

    Se dejan pasar normalmente.
    */

    return;

  }
);