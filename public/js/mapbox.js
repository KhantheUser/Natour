

export const displayMap = (locations)=>{
    mapboxgl.accessToken = 'pk.eyJ1IjoiZHVjdGhpZW5uZ3V5ZW4xNjAxIiwiYSI6ImNsOGcyM2thejAzNjEzdnAydG1jcThienQifQ.hC5ds6fJSFtTf7kDnKbzDw';

var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/ducthiennguyen1601/cl8g3s4h2000115nr0da2ltej',
    // scrollZoom :false
    // Kinh độ vĩ độ
    // center : [-118.113491,31.111745],
    // zoom : 4,
    // tương tác với map
    // interactive : false,

   
  });
const bounds = new mapboxgl.LngLatBounds()

locations.forEach(loc=>{
    //create marker
    const el = document.createElement('div')
    el.className ='marker'
    //Add marker
    new mapboxgl.Marker({
        element : el,
        anchor :'bottom'
    }).setLngLat(loc.coordinates).addTo(map)
    
    //Add pop up
    new mapboxgl.Popup({
        offset :30
    }).setLngLat(loc.coordinates).setHTML(`<p>Day : ${loc.day} : ${loc.description}</p>`).addTo(map)
    
    //Extend map bounds to include current location
    bounds.extend(loc.coordinates)
})

map.fitBounds(bounds,{
    padding :{
        top :200,
        bottom:200,
        left:100,
        right:100
    }
})
}
