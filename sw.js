"use strict";

const CACHE_NAME = "pos-offline-v7";

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

const OFFLINE_CLIENT_SCRIPT = `
(function(){
  "use strict";

  const QUEUE_KEY = "POS_PENDING_CUSTOMERS_V1";
  const CACHE_KEY = "POS_BUSINESS_CACHE_V4";

  const BUSINESSES = [
    "BakeQuiri",
    "SpicyRoll"
  ];

  const SUPABASE_URL =
    "https://jrxklpstlloeckihcduv.supabase.co";

  const SUPABASE_KEY =
    "sb_publishable_XNTaRpicaIpdgNnzLy8yAA_5M4K_pWp";

  let modal;
  let nameInput;
  let phoneInput;
  let notesInput;
  let saving = false;

  const $ = id =>
    document.getElementById(id);


  /* =====================================================
     ID LOCAL
  ===================================================== */

  function makeId(){

    if(
      crypto &&
      typeof crypto.randomUUID === "function"
    ){
      return crypto.randomUUID();
    }

    return (
      "offline-customer-" +
      Date.now() +
      "-" +
      Math.random()
        .toString(36)
        .slice(2)
    );

  }


  /* =====================================================
     CACHE DE NEGOCIOS
  ===================================================== */

  function readCache(){

    try{

      return JSON.parse(
        localStorage.getItem(
          CACHE_KEY
        ) || "{}"
      );

    }

    catch{

      return {};

    }

  }


  function writeCache(value){

    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify(value)
    );

  }


  /* =====================================================
     COLA DE CLIENTES PENDIENTES
  ===================================================== */

  function readQueue(){

    try{

      const value =
        JSON.parse(
          localStorage.getItem(
            QUEUE_KEY
          ) || "[]"
        );

      return Array.isArray(value)
        ? value
        : [];

    }

    catch{

      return [];

    }

  }


  function writeQueue(value){

    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify(value)
    );

  }


  /* =====================================================
     GUARDAR CLIENTE LOCALMENTE
  ===================================================== */

  function addLocal(customer){

    const data =
      readCache();

    BUSINESSES.forEach(
      business => {

        if(!data[business]){

          data[business] = {

            products: [],
            payments: [],
            customers: []

          };

        }

        if(
          !Array.isArray(
            data[business].customers
          )
        ){

          data[business].customers = [];

        }

        const exists =
          data[business]
            .customers
            .some(
              item =>
                String(item.id) ===
                String(customer.id)
            );

        if(!exists){

          data[business]
            .customers
            .push(customer);

        }

        data[business].savedAt =
          new Date().toISOString();

      }
    );

    writeCache(data);

  }


  /* =====================================================
     REEMPLAZAR ID LOCAL POR ID DE SUPABASE
  ===================================================== */

  function replaceLocal(
    localId,
    customer
  ){

    const data =
      readCache();

    BUSINESSES.forEach(
      business => {

        if(
          !data[business] ||
          !Array.isArray(
            data[business].customers
          )
        ){

          return;

        }

        data[business].customers =
          data[business]
            .customers
            .map(
              item =>
                String(item.id) ===
                String(localId)
                ? customer
                : item
            );

      }
    );

    writeCache(data);

  }


  /* =====================================================
     ACTUALIZAR ESTADO DEL POS
  ===================================================== */

  function updatePOS(customer){

    try{

      const data =
        readCache();

      const all = [];

      BUSINESSES.forEach(
        business => {

          const list =
            data[business]?.customers ||
            [];

          list.forEach(
            customerItem => {

              const exists =
                all.some(
                  item =>
                    String(item.id) ===
                    String(customerItem.id)
                );

              if(!exists){

                all.push(
                  customerItem
                );

              }

            }
          );

        }
      );

      const currentExists =
        all.some(
          item =>
            String(item.id) ===
            String(customer.id)
        );

      if(!currentExists){

        all.push(customer);

      }

      window.eval(

        "customers=" +
        JSON.stringify(all) +
        ";" +

        "selectedCustomerId=" +
        JSON.stringify(customer.id) +
        ";" +

        "if(typeof renderSelectedCustomer==='function')" +
        "renderSelectedCustomer();" +

        "if(typeof renderCustomerResults==='function')" +
        "renderCustomerResults('');"

      );

    }

    catch(error){

      console.warn(
        "POS customer state:",
        error
      );

    }

  }


  /* =====================================================
     MENSAJE EN EL POS
  ===================================================== */

  function showMessage(
    text,
    type
  ){

    try{

      window.eval(

        "if(typeof showStatus==='function')" +

        "showStatus(" +

        JSON.stringify(text) +

        "," +

        JSON.stringify(
          type || "ok"
        ) +

        ");"

      );

    }

    catch{

    }

  }


  /* =====================================================
     INSERTAR EN SUPABASE
  ===================================================== */

  async function insertOnline(
    customer
  ){

    try{

      if(
        !window.supabase ||
        typeof window.supabase.createClient !==
        "function"
      ){

        return null;

      }

      const client =
        window.supabase.createClient(
          SUPABASE_URL,
          SUPABASE_KEY
        );

      const result =
        await client
          .from("customers")
          .insert({

            name:
              customer.name,

            phone:
              customer.phone ||
              null,

            notes:
              customer.notes ||
              null

          })
          .select(
            "id,name,phone,notes"
          )
          .single();

      if(result.error){

        throw result.error;

      }

      return (
        result.data ||
        null
      );

    }

    catch(error){

      console.warn(
        "Customer sync:",
        error
      );

      return null;

    }

  }


  /* =====================================================
     SINCRONIZAR CLIENTES
  ===================================================== */

  async function syncQueue(){

    if(!navigator.onLine){

      return;

    }

    const pending =
      readQueue();

    if(!pending.length){

      return;

    }

    const remaining = [];

    for(
      const customer of pending
    ){

      const saved =
        await insertOnline(
          customer
        );

      if(saved){

        replaceLocal(
          customer.id,
          saved
        );

        try{

          const selected =
            window.eval(
              "typeof selectedCustomerId!=='undefined'" +
              "?selectedCustomerId:null"
            );

          if(
            String(selected) ===
            String(customer.id)
          ){

            updatePOS(
              saved
            );

          }

        }

        catch{

        }

      }

      else{

        remaining.push(
          customer
        );

      }

    }

    writeQueue(
      remaining
    );

  }


  /* =====================================================
     CERRAR MODAL
  ===================================================== */

  function close(){

    if(modal){

      modal.classList.remove(
        "show"
      );

    }

  }


  /* =====================================================
     ABRIR MODAL
  ===================================================== */

  function open(){

    if(!modal){

      build();

    }

    nameInput.value = "";
    phoneInput.value = "";
    notesInput.value = "";

    modal.classList.add(
      "show"
    );

    setTimeout(
      () => {

        nameInput.focus();

      },
      50
    );

  }


  /* =====================================================
     GUARDAR CLIENTE
  ===================================================== */

  async function save(){

    if(saving){

      return;

    }

    const name =
      nameInput.value.trim();

    const phone =
      phoneInput.value.trim();

    const notes =
      notesInput.value.trim();

    if(!name){

      alert(
        "Escribe el nombre del cliente."
      );

      nameInput.focus();

      return;

    }

    saving = true;

    const button =
      $("ocmSave");

    button.disabled = true;

    button.textContent =
      "Guardando...";

    const localCustomer = {

      id:
        makeId(),

      name:
        name,

      phone:
        phone || null,

      notes:
        notes || null

    };


    try{

      let customer =
        localCustomer;


      /* ================================================
         CON INTERNET
      ================================================= */

      if(navigator.onLine){

        const onlineCustomer =
          await insertOnline(
            localCustomer
          );

        if(onlineCustomer){

          customer =
            onlineCustomer;

        }

        else{

          const pending =
            readQueue();

          pending.push(
            localCustomer
          );

          writeQueue(
            pending
          );

        }

      }


      /* ================================================
         SIN INTERNET
      ================================================= */

      else{

        const pending =
          readQueue();

        pending.push(
          localCustomer
        );

        writeQueue(
          pending
        );

      }


      /* ================================================
         GUARDAR LOCALMENTE
      ================================================= */

      addLocal(
        customer
      );


      /* ================================================
         SELECCIONAR AUTOMÁTICAMENTE
      ================================================= */

      updatePOS(
        customer
      );


      close();


      /* ================================================
         MENSAJE
      ================================================= */

      if(
        customer.id ===
        localCustomer.id
      ){

        showMessage(

          "📴 Cliente guardado localmente y seleccionado. " +
          "Se sincronizará cuando vuelva Internet.",

          "offline"

        );

      }

      else{

        showMessage(

          "✅ Cliente guardado en Supabase y seleccionado.",

          "ok"

        );

      }

    }

    finally{

      saving =
        false;

      button.disabled =
        false;

      button.textContent =
        "Guardar cliente";

    }

  }


  /* =====================================================
     CONSTRUIR MODAL
  ===================================================== */

  function build(){

    const style =
      document.createElement(
        "style"
      );


    style.textContent =
      ".ocm-backdrop{" +
      "position:fixed;" +
      "inset:0;" +
      "background:rgba(0,0,0,.58);" +
      "z-index:99999;" +
      "display:none;" +
      "align-items:center;" +
      "justify-content:center;" +
      "padding:18px" +
      "}" +

      ".ocm-backdrop.show{" +
      "display:flex" +
      "}" +

      ".ocm-modal{" +
      "width:min(520px,100%);" +
      "max-height:92vh;" +
      "overflow:auto;" +
      "background:#fff;" +
      "border-radius:24px;" +
      "padding:24px;" +
      "box-shadow:0 20px 60px rgba(0,0,0,.3)" +
      "}" +

      ".ocm-title{" +
      "font-size:27px;" +
      "font-weight:900;" +
      "color:#111827;" +
      "margin-bottom:7px" +
      "}" +

      ".ocm-subtitle{" +
      "color:#6b7280;" +
      "font-size:16px;" +
      "margin-bottom:20px" +
      "}" +

      ".ocm-label{" +
      "display:block;" +
      "font-size:15px;" +
      "font-weight:800;" +
      "color:#374151;" +
      "margin:14px 0 7px" +
      "}" +

      ".ocm-input{" +
      "width:100%;" +
      "padding:15px;" +
      "border:3px solid #ddd;" +
      "border-radius:13px;" +
      "font-size:17px;" +
      "background:#fff;" +
      "box-sizing:border-box" +
      "}" +

      ".ocm-input:focus{" +
      "outline:none;" +
      "border-color:#2563eb" +
      "}" +

      ".ocm-actions{" +
      "display:grid;" +
      "grid-template-columns:1fr 1fr;" +
      "gap:10px;" +
      "margin-top:20px" +
      "}" +

      ".ocm-btn{" +
      "min-height:54px;" +
      "border:0;" +
      "border-radius:14px;" +
      "font-size:17px;" +
      "font-weight:900;" +
      "cursor:pointer" +
      "}" +

      ".ocm-cancel{" +
      "background:#f3f4f6;" +
      "color:#374151" +
      "}" +

      ".ocm-save{" +
      "background:#2563eb;" +
      "color:#fff" +
      "}" +

      ".ocm-btn:disabled{" +
      "opacity:.6;" +
      "cursor:wait" +
      "}" +

      ".ocm-note{" +
      "margin-top:14px;" +
      "padding:12px;" +
      "border-radius:12px;" +
      "background:#fef3c7;" +
      "color:#92400e;" +
      "font-size:14px;" +
      "font-weight:700" +
      "}" +

      "@media(max-width:500px){" +
      ".ocm-actions{grid-template-columns:1fr}" +
      ".ocm-modal{padding:20px}" +
      "}";


    document.head.appendChild(
      style
    );


    modal =
      document.createElement(
        "div"
      );

    modal.id =
      "offlineClientModal";

    modal.className =
      "ocm-backdrop";


    modal.innerHTML =

      "<div " +
      "class=\"ocm-modal\" " +
      "role=\"dialog\" " +
      "aria-modal=\"true\">" +

      "<div class=\"ocm-title\">" +
      "👤 Nuevo cliente" +
      "</div>" +

      "<div class=\"ocm-subtitle\">" +
      "El cliente quedará disponible para " +
      "BakeQuiri y SpicyRoll." +
      "</div>" +

      "<label class=\"ocm-label\">" +
      "Nombre *" +
      "</label>" +

      "<input " +
      "id=\"ocmName\" " +
      "class=\"ocm-input\" " +
      "type=\"text\" " +
      "autocomplete=\"name\" " +
      "placeholder=\"Nombre del cliente\">" +

      "<label class=\"ocm-label\">" +
      "Teléfono" +
      "</label>" +

      "<input " +
      "id=\"ocmPhone\" " +
      "class=\"ocm-input\" " +
      "type=\"tel\" " +
      "autocomplete=\"tel\" " +
      "placeholder=\"Número de teléfono\">" +

      "<label class=\"ocm-label\">" +
      "Notas" +
      "</label>" +

      "<textarea " +
      "id=\"ocmNotes\" " +
      "class=\"ocm-input\" " +
      "rows=\"3\" " +
      "placeholder=\"Notas opcionales\">" +
      "</textarea>" +

      "<div class=\"ocm-note\">" +
      "🟢 Con Internet se guardará en Supabase. " +
      "📴 Sin Internet se guardará en este dispositivo " +
      "y se sincronizará después." +
      "</div>" +

      "<div class=\"ocm-actions\">" +

      "<button " +
      "id=\"ocmCancel\" " +
      "class=\"ocm-btn ocm-cancel\" " +
      "type=\"button\">" +
      "Cancelar" +
      "</button>" +

      "<button " +
      "id=\"ocmSave\" " +
      "class=\"ocm-btn ocm-save\" " +
      "type=\"button\">" +
      "Guardar cliente" +
      "</button>" +

      "</div>" +

      "</div>";


    document.body.appendChild(
      modal
    );


    nameInput =
      $("ocmName");

    phoneInput =
      $("ocmPhone");

    notesInput =
      $("ocmNotes");


    $("ocmCancel").onclick =
      close;

    $("ocmSave").onclick =
      save;


    modal.onclick =
      event => {

        if(
          event.target ===
          modal
        ){

          close();

        }

      };

  }


  /* =====================================================
     INTERCEPTAR + CLIENTE
  ===================================================== */

  function hook(){

    const button =
      $("addClientButton");

    if(
      !button ||
      button.dataset.ocmHooked ===
      "1"
    ){

      return;

    }


    button.dataset.ocmHooked =
      "1";


    button.addEventListener(

      "click",

      event => {

        event.preventDefault();

        event.stopImmediatePropagation();

        open();

      },

      true

    );

  }


  /* =====================================================
     INICIO
  ===================================================== */

  function init(){

    build();

    hook();

    syncQueue();


    window.addEventListener(
      "online",
      syncQueue
    );


    new MutationObserver(
      hook
    )
    .observe(
      document.body,
      {
        childList:true,
        subtree:true
      }
    );

  }


  if(
    document.readyState ===
    "loading"
  ){

    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once:true
      }
    );

  }

  else{

    init();

  }

})();
`;


function isIndex(url){

  return (
    url.pathname === "/" ||
    url.pathname.endsWith(
      "/index.html"
    )
  );

}


/* =====================================================
   CACHEAR ARCHIVOS
===================================================== */

async function cacheAppFiles(){

  const cache =
    await caches.open(
      CACHE_NAME
    );


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
        "No se pudo cachear:",
        file,
        error
      );

    }

  }


  try{

    const response =
      await fetch(
        SUPABASE_SCRIPT,
        {
          mode:"no-cors",
          cache:"no-store"
        }
      );


    await cache.put(
      SUPABASE_SCRIPT,
      response
    );

  }

  catch(error){

    console.warn(
      "No se pudo cachear Supabase:",
      error
    );

  }

}


/* =====================================================
   INYECTAR FUNCIONES DE CLIENTES
===================================================== */

async function injectClientScript(
  response
){

  try{

    const type =
      response.headers.get(
        "content-type"
      ) || "";


    if(
      !type.includes(
        "text/html"
      )
    ){

      return response;

    }


    const text =
      await response.text();


    if(
      text.includes(
        "data-offline-client-injected"
      )
    ){

      return new Response(
        text,
        {
          status:
            response.status,

          statusText:
            response.statusText,

          headers:
            response.headers

        }
      );

    }


    const url =
      new URL(
        response.url ||
        self.location.href
      );


    if(
      !isIndex(url)
    ){

      return new Response(
        text,
        {
          status:
            response.status,

          statusText:
            response.statusText,

          headers:
            response.headers

        }
      );

    }


    const injection =

      '<script data-offline-client-injected>' +

      "\\n" +

      OFFLINE_CLIENT_SCRIPT
        .replace(
          /<\/script/gi,
          "<\\/script"
        ) +

      "\\n</script>";


    const body =
      text.includes(
        "</body>"
      )

      ? text.replace(
          "</body>",
          injection +
          "</body>"
        )

      : text +
        injection;


    const headers =
      new Headers(
        response.headers
      );


    headers.set(
      "content-type",
      "text/html; charset=utf-8"
    );


    return new Response(
      body,
      {
        status:
          response.status,

        statusText:
          response.statusText,

        headers

      }
    );

  }

  catch(error){

    console.warn(
      "No se pudo inyectar módulo offline:",
      error
    );

    return response;

  }

}


/* =====================================================
   INSTALL
===================================================== */

self.addEventListener(
  "install",
  event => {

    event.waitUntil(

      (async () => {

        await cacheAppFiles();

        await self.skipWaiting();

      })()

    );

  }
);


/* =====================================================
   ACTIVATE
===================================================== */

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


/* =====================================================
   MENSAJES
===================================================== */

self.addEventListener(
  "message",
  event => {

    if(
      event.data?.type ===
      "SKIP_WAITING"
    ){

      self.skipWaiting();

    }

  }
);


/* =====================================================
   FETCH
===================================================== */

self.addEventListener(
  "fetch",
  event => {

    const request =
      event.request;


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


    /* ================================================
       SUPABASE API
       NO INTERCEPTAR
    ================================================= */

    if(
      url.hostname.endsWith(
        ".supabase.co"
      )
    ){

      return;

    }


    /* ================================================
       LIBRERÍA SUPABASE
    ================================================= */

    if(
      url.href.startsWith(
        SUPABASE_SCRIPT
      )
    ){

      event.respondWith(

        (async () => {

          try{

            const network =
              await fetch(
                request
              );


            const cache =
              await caches.open(
                CACHE_NAME
              );


            cache
              .put(
                request,
                network.clone()
              )
              .catch(
                () => {}
              );


            return network;

          }

          catch{

            return (

              await caches.match(
                request
              )

            ) ||

            (

              await caches.match(
                SUPABASE_SCRIPT
              )

            ) ||

            Response.error();

          }

        })()

      );

      return;

    }


    /* ================================================
       NAVEGACIONES
    ================================================= */

    if(
      request.mode ===
      "navigate"
    ){

      event.respondWith(

        (async () => {

          try{

            const network =
              await fetch(
                request,
                {
                  cache:
                    "no-store"
                }
              );


            const finalResponse =
              await injectClientScript(
                network.clone()
              );


            const cache =
              await caches.open(
                CACHE_NAME
              );


            cache
              .put(
                request,
                finalResponse.clone()
              )
              .catch(
                () => {}
              );


            if(
              isIndex(url)
            ){

              cache
                .put(
                  "./index.html",
                  finalResponse.clone()
                )
                .catch(
                  () => {}
                );

            }


            return finalResponse;

          }

          catch{

            let cached =
              await caches.match(
                request
              );


            if(
              !cached &&
              isIndex(url)
            ){

              cached =
                await caches.match(
                  "./index.html"
                );

            }


            if(cached){

              return injectClientScript(
                cached.clone()
              );

            }


            const fallback =
              await caches.match(
                "./index.html"
              );


            if(fallback){

              return injectClientScript(
                fallback.clone()
              );

            }


            return new Response(

              "POS offline: esta página todavía no ha sido guardada en el dispositivo.",

              {
                status:
                  503,

                headers:{
                  "Content-Type":
                    "text/plain;charset=utf-8"
                }

              }

            );

          }

        })()

      );

      return;

    }


    /* ================================================
       OTROS RECURSOS
    ================================================= */

    event.respondWith(

      (async () => {

        const cached =
          await caches.match(
            request
          );


        try{

          const network =
            await fetch(
              request
            );


          if(
            network.ok
          ){

            const cache =
              await caches.open(
                CACHE_NAME
              );


            cache
              .put(
                request,
                network.clone()
              )
              .catch(
                () => {}
              );

          }


          return network;

        }

        catch{

          return (
            cached ||
            Response.error()
          );

        }

      })()

    );

  }
);