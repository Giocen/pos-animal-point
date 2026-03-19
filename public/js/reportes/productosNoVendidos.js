import { supabaseClient, protegerSesion } from "/js/proteccion.js";

document.addEventListener("DOMContentLoaded", async ()=>{

  await protegerSesion(["admin"]);

  const negocioId =
    localStorage.getItem("negocio_id") ||
    window.usuarioActual?.negocio_id;

  const tabla = document.getElementById("tablaProductos");
  const inputBuscar = document.getElementById("buscar");

  const totalInventario = document.getElementById("totalInventario");
  const prod30 = document.getElementById("prod30");
  const prod60 = document.getElementById("prod60");

  let listaOriginal = [];

  async function cargar(){

    const { data, error } = await supabaseClient
      .from("v_productos_no_vendidos")
      .select("*")
      .eq("negocio_id", negocioId)
      .order("dias_sin_vender",{ascending:false});

    if(error){
      console.error(error);
      Swal.fire("Error","No se pudieron cargar datos","error");
      return;
    }

    listaOriginal = data || [];

    render(listaOriginal);
    resumen(listaOriginal);

  }


  function resumen(lista){

    let inventario=0;
    let mas30=0;
    let mas60=0;

    lista.forEach(p=>{

      inventario+=Number(p.valor_inventario||0);

      if(p.dias_sin_vender>=30) mas30++;
      if(p.dias_sin_vender>=60) mas60++;

    });

    totalInventario.innerText="$"+inventario.toFixed(2);
    prod30.innerText=mas30;
    prod60.innerText=mas60;

  }


  function render(lista){

    tabla.innerHTML="";

    if(!lista.length){
      tabla.innerHTML=`<tr><td colspan="9">Sin productos</td></tr>`;
      return;
    }

    lista.forEach(p=>{

      const dias=p.dias_sin_vender;

      let textoDias="Nunca vendido";
      if(dias && dias<900) textoDias=dias+" días";

      let color="text-gray-500";

      if(dias>=60) color="text-red-600 font-bold";
      else if(dias>=30) color="text-orange-500";

      tabla.insertAdjacentHTML("beforeend",`

      <tr>

      <td>${p.sku||""}</td>
      <td>${p.nombre||""}</td>
      <td>${p.categoria||""}</td>

      <td class="text-right">$${Number(p.costo||0).toFixed(2)}</td>

      <td class="text-right">$${Number(p.precio_base||0).toFixed(2)}</td>

      <td class="text-right">${Number(p.existencias||0)}</td>

      <td class="text-right">$${Number(p.valor_inventario||0).toFixed(2)}</td>

      <td class="text-right ${color}">${textoDias}</td>

      <td class="text-center">

      <button
      class="promo bg-green-600 text-white px-2 py-1 rounded text-xs"
      data-id="${p.id}"
      data-precio="${p.precio_base}">

      Promoción

      </button>

      </td>

      </tr>

      `);

    });

  }


  tabla.addEventListener("click", async e=>{

    const btn=e.target.closest(".promo");
    if(!btn) return;

    const id=btn.dataset.id;
    const precio=Number(btn.dataset.precio);

    const { value } = await Swal.fire({
      title:"Nuevo precio promocional",
      input:"number",
      inputValue:(precio*0.9).toFixed(2),
      showCancelButton:true
    });

    if(!value) return;

    const { error } = await supabaseClient
      .from("productos")
      .update({precio_base:value})
      .eq("id",id);

    if(error){
      Swal.fire("Error","No se pudo aplicar promoción","error");
      return;
    }

    Swal.fire("Listo","Precio actualizado","success");
    cargar();

  });


  inputBuscar.addEventListener("input",()=>{

    const q=inputBuscar.value.toLowerCase();

    const filtrados=listaOriginal.filter(p=>
      (p.nombre||"").toLowerCase().includes(q) ||
      (p.sku||"").toLowerCase().includes(q) ||
      (p.categoria||"").toLowerCase().includes(q)
    );

    render(filtrados);

  });

  cargar();

});