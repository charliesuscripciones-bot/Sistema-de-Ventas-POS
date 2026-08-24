"use strict";

/*
=========================================================
 SISTEMA DE VENTAS POS
 SERVICE WORKER — OFFLINE
=========================================================

 Funciones:

 • Guarda las páginas principales del POS.
 • Permite abrir Dashboard sin Internet.
 • Permite abrir POS sin Internet.
 • Guarda la librería de Supabase.
 • Intercepta navegación cuando no hay conexión.
 • Actualiza automáticamente la versión del caché.
 • No intenta guardar las respuestas dinámicas de Supabase.
=========================================================
*/


/* ========================================================
   VERSIÓN DEL CACHÉ
======================================================== */

const CACHE_VERSION =
  "pos-offline-v4";


/* ========================================================
   CACHÉ PRINCIPAL
======================================================== */

const APP_CACHE =
  CACHE_VERSION + "-app";


/* ========================================================
   ARCHIVOS PRINCIPALES DEL POS
======================================================== */

const APP_SHELL = [

  "./",

  "./index.html",

  "./dashboard.html",

  "./clientes.html",

  "./cuentas.html",

  "./historial.html",

  "./inventario.html",

  "./manifest.json",

  "./sw.js"

];


/* ========================================================
   RECURSOS EXTERNOS NECESARIOS OFFLINE
======================================================== */

const EXTERNAL_RESOURCES = [

  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"

];


/* ========================================================
   INSTALACIÓN
======================================================== */

self.addEventListener(
  "install",
  event => {

    event.waitUntil(

      (async () => {

        const cache =
          await caches.open(
            APP_CACHE
          );


        /*
        ----------------------------------------------------
        Guardamos primero los archivos locales.
        ----------------------------------------------------
        */

        try {

          await cache.addAll(
            APP_SHELL
          );

          console.log(
            "[SW] App shell guardado."
          );

        }

        catch(error) {

          console.error(
            "[SW] Error guardando App Shell:",
            error
          );

        }


        /*
        ----------------------------------------------------
        Guardamos Supabase por separado.
        ----------------------------------------------------

        Si el CDN falla durante la instalación,
        NO queremos que todo el Service Worker falle.
        ----------------------------------------------------
        */

        for(
          const resource
          of EXTERNAL_RESOURCES
        ){

          try {

            const response =
              await fetch(
                resource,
                {
                  cache:
                    "no-store"
                }
              );


            if(
              response.ok
            ){

              await cache.put(
                resource,
                response.clone()
              );


              console.log(
                "[SW] Recurso externo guardado:",
                resource
              );

            }

          }

          catch(error) {

            console.warn(
              "[SW] No se pudo guardar recurso externo:",
              resource,
              error
            );

          }

        }


        /*
        ----------------------------------------------------
        Activa inmediatamente esta versión.
        ----------------------------------------------------
        */

        await self.skipWaiting();

      })()

    );

  }
);


/* ========================================================
   ACTIVACIÓN
======================================================== */

self.addEventListener(
  "activate",
  event => {

    event.waitUntil(

      (async () => {

        /*
        ----------------------------------------------------
        Elimina versiones anteriores del caché.
        ----------------------------------------------------
        */

        const cacheNames =
          await caches.keys();


        await Promise.all(

          cacheNames
            .filter(
              cacheName =>
                cacheName !== APP_CACHE
            )
            .map(
              cacheName =>
                caches.delete(
                  cacheName
                )
            )

        );


        /*
        ----------------------------------------------------
        Toma control de todas las páginas abiertas.
        ----------------------------------------------------
        */

        await self.clients.claim();


        console.log(
          "[SW] Activado:",
          CACHE_VERSION
        );

      })()

    );

  }
);


/* ========================================================
   FETCH
======================================================== */

self.addEventListener(
  "fetch",
  event => {

    const request =
      event.request;


    /*
    --------------------------------------------------------
    Solo manejamos GET.
    --------------------------------------------------------
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
    ========================================================
    1. SUPABASE JS DESDE CDN
    ========================================================
    */

    if(
      url.origin ===
      "https://cdn.jsdelivr.net"
    ){

      event.respondWith(

        cacheFirst(
          request
        )

      );

      return;

    }


    /*
    ========================================================
    2. ARCHIVOS DEL PROPIO POS
    ========================================================
    */

    if(
      url.origin ===
      self.location.origin
    ){

      /*
      ------------------------------------------------------
      Navegación HTML
      ------------------------------------------------------
      */

      if(
        request.mode ===
        "navigate"
      ){

        event.respondWith(

          navigationHandler(
            request
          )

        );

        return;

      }


      /*
      ------------------------------------------------------
      CSS / JS / imágenes / manifest / etc.
      ------------------------------------------------------
      */

      event.respondWith(

        cacheFirst(
          request
        )

      );

      return;

    }


    /*
    ========================================================
    3. RESTO DE INTERNET
    ========================================================

    No intentamos cachearlo.
    Esto evita guardar respuestas dinámicas,
    especialmente las de Supabase.
    ========================================================
    */

  }
);


/* ========================================================
   CACHE FIRST
======================================================== */

async function cacheFirst(
  request
){

  /*
  ----------------------------------------------------------
  Primero buscamos en caché.
  ----------------------------------------------------------
  */

  const cached =
    await caches.match(
      request
    );


  if(
    cached
  ){

    /*
    --------------------------------------------------------
    Tenemos una copia local.
    --------------------------------------------------------
    */

    return cached;

  }


  /*
  ----------------------------------------------------------
  No está en caché.
  Intentamos Internet.
  ----------------------------------------------------------
  */

  try {

    const response =
      await fetch(
        request
      );


    /*
    --------------------------------------------------------
    Si la respuesta es válida, guardamos una copia.
    --------------------------------------------------------
    */

    if(
      response &&
      response.ok
    ){

      const cache =
        await caches.open(
          APP_CACHE
        );


      await cache.put(
        request,
        response.clone()
      );

    }


    return response;

  }

  catch(error) {

    console.warn(
      "[SW] Recurso no disponible:",
      request.url
    );


    /*
    --------------------------------------------------------
    No hay Internet y tampoco existe caché.
    --------------------------------------------------------
    */

    return new Response(
      "",
      {
        status:404,
        statusText:
          "Recurso no disponible offline"
      }
    );

  }

}


/* ========================================================
   NAVEGACIÓN OFFLINE
======================================================== */

async function navigationHandler(
  request
){

  /*
  ----------------------------------------------------------
  1. Intentamos Internet primero.
  ----------------------------------------------------------
  */

  try {

    const response =
      await fetch(
        request
      );


    if(
      response &&
      response.ok
    ){

      /*
      ------------------------------------------------------
      Guardamos la página solicitada.
      ------------------------------------------------------
      */

      const cache =
        await caches.open(
          APP_CACHE
        );


      await cache.put(
        request,
        response.clone()
      );


      return response;

    }

  }

  catch(error) {

    console.log(
      "[SW] Navegación offline:",
      request.url
    );

  }


  /*
  ----------------------------------------------------------
  2. Si no hay Internet, buscamos exactamente la página.
  ----------------------------------------------------------
  */

  const cached =
    await caches.match(
      request
    );


  if(
    cached
  ){

    return cached;

  }


  /*
  ----------------------------------------------------------
  3. Intentamos obtener el archivo por URL.
  ----------------------------------------------------------
  */

  const url =
    new URL(
      request.url
    );


  const pathname =
    url.pathname;


  const filename =
    pathname.split(
      "/"
    ).pop();


  if(
    filename
  ){

    const cachedFilename =
      await caches.match(
        "./" +
        filename
      );


    if(
      cachedFilename
    ){

      return cachedFilename;

    }

  }


  /*
  ==========================================================
  4. FALLBACK PRINCIPAL
  ==========================================================

  Si no encontramos la página solicitada,
  abrimos el POS principal.
  ==========================================================
  */

  const offlineHome =
    await caches.match(
      "./index.html"
    );


  if(
    offlineHome
  ){

    return offlineHome;

  }


  /*
  ----------------------------------------------------------
  Último recurso.
  ----------------------------------------------------------
  */

  return new Response(

    `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport"
      content="width=device-width,initial-scale=1">
<title>POS Offline</title>
<style>
body{
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  background:#f5f5f5;
  padding:30px;
  text-align:center;
}
.card{
  background:white;
  border-radius:18px;
  padding:30px;
  max-width:500px;
  margin:40px auto;
}
h1{
  color:#111827;
}
p{
  color:#666;
}
</style>
</head>
<body>
<div class="card">
<h1>📱 Sistema de Ventas POS</h1>
<p>
El sistema está funcionando sin conexión.
</p>
<p>
Abre nuevamente el POS cuando se haya cargado
la aplicación al menos una vez con Internet.
</p>
</div>
</body>
</html>`,

    {
      status:200,
      headers:{
        "Content-Type":
          "text/html; charset=utf-8"
      }
    }

  );

}


/* ========================================================
   MENSAJE DESDE LA PÁGINA
======================================================== */

self.addEventListener(
  "message",
  event => {

    if(
      event.data ===
      "SKIP_WAITING"
    ){

      self.skipWaiting();

    }

  }
);


/* ========================================================
   DEBUG
======================================================== */

console.log(
  "[SW] Sistema POS Offline cargado:",
  CACHE_VERSION
);