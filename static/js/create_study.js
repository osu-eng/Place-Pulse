var poly, map;
var markers;
var path;
var markerIcon;

var mapReady = false;

$(document).ready(function() {

    setupUI();

    // Hide entire map interface
    $('#mapInterface').hide();

    // Load the GMaps API, callback on load to initialize()
    function loadScript() {
      var script = document.createElement("script");
      script.type = "text/javascript";
      script.src = "http://maps.google.com/maps/api/js?sensor=false&callback=initialize";
      document.body.appendChild(script);
    }
    
    loadScript();
});

function validateStudyForm() {
    return true; // TODO: basic form validation.
}

function setupUI() {
    $('#clearLastPoint').click(clearLast);
    $('#clearCurrentSelection').click(clearOverlays);
    
    $('#finishStudyForm').click(function() {
        if (!mapReady) {
            alert("ERROR: Couldn't initialize Google Maps!");
            return;
        }
        
        if (validateStudyForm()) {
            $('#mapInterface').show();
            $('#createStudyForm').hide();
            
            startMap();
        }
    });
    
    $('#submitPolygon').click(function() {
        // Create a comma-separated list of numbers representing the polygon.
        // List is flattened, so (x1,y1),(x2,y2) becomes x1,y1,x2,y2 etc...
        var polyPath = poly.getPath().getArray();
        var polyArray = [];
        for (var polygonIdx = 0; polygonIdx < polyPath.length; polygonIdx++) {
            polyArray.push(polyPath[polygonIdx].Qa);
			polyArray.push(polyPath[polygonIdx].Pa);
        }
        
        $.ajax({
            url:'/study/create/',
            // Expect JSON to be returned. This is also enforced on the server via mimetype.
            dataType: 'json',
            data: {
                polygon: polyArray.toString(),
                study_question: $('#study_question').val(),
                locations_requested: $('#locations_requested').val()
            },
            type: 'POST',
            success: function(data) {
                window.location.replace(window.location.protocol + '//' + window.location.host + "/study/populate/" + data.studyID);
            }
        });
    });
}

/*
    Map polygon chooser.
*/

function initialize() {
    // Gmaps callback happened.
    mapReady = true;
}

function startMap() {
    // Initialize map interface
    markers = [];
	path = new google.maps.MVCArray;
	markerIcon = '/static/images/yellow.png';
    var varzoom = 10;
    panMap(varzoom);
}

function panMap(varzoom)
 {
    // var newLoc = new google.maps.LatLng(start);

    map = new google.maps.Map($('#map').get()[0], {
        zoom: varzoom,
        // center: newLoc,
        draggableCursor: 'crosshair',
        mapTypeId: google.maps.MapTypeId.HYBRID
    });

    poly = new google.maps.Polygon({
        strokeWeight: 2,
        strokeOpacity: 1,
        strokeColor: '#eeb44b',
        fillColor: '#eeb44b'
    });

    // var swpoint = new google.maps.LatLng(point.swlat, point.swlng); //Google adds lat then lng, even though lat is Y coord and Lng is X
    //     var nepoint = new google.maps.LatLng(point.nelat, point.nelng);
    //     var bounds = new google.maps.LatLngBounds(swpoint, nepoint);
    
    map.fitBounds(new google.maps.LatLngBounds(new google.maps.LatLng(7.188100871179058,-129.39241035029778),new google.maps.LatLng(55.07836723201517,-50.64241035029778) ));
    // map.fitBounds(bounds);

    // addPointLatLng(swpoint.lat(), swpoint.lng());
    // addPointLatLng(nepoint.lat(), swpoint.lng());
    // addPointLatLng(nepoint.lat(), nepoint.lng());
    // addPointLatLng(swpoint.lat(), nepoint.lng());

    poly.setMap(map);
    poly.setPaths(new google.maps.MVCArray([path]));

    google.maps.event.addListener(map, 'click', addPoint);
    google.maps.event.addListener(poly, 'click', addPoint);
}
/*
    Overlay stuff.
*/
function clearLast() {
    google.maps.event.trigger(markers[markers.length - 1], 'click');
}
function addPointLatLng(lat, lng) {
    var point = new google.maps.LatLng(lat, lng);
    // path.insertAt(path.length, point);
    var marker = new google.maps.Marker({
        position: point,
        map: map,
        draggable: true,
        icon: markerIcon
    });
    markers.push(marker);

    google.maps.event.addListener(marker, 'click',
    function() {
        marker.setMap(null);
        for (var i = 0, I = markers.length; i < I && markers[i] != marker; ++i);
        markers.splice(i, 1);
        path.removeAt(i);
    }
    );

    google.maps.event.addListener(marker, 'dragend',
    function() {
        for (var i = 0, I = markers.length; i < I && markers[i] != marker; ++i);
        path.setAt(i, marker.getPosition());
    }
    );
}
function clearOverlays() {
    for (var m = 0; m < markers.length; m) {
        google.maps.event.trigger(markers[0], 'click');
    }
}
function removeMarker(index) {
    if (markers.length > 0) {
        //clicked marker has already been deleted
        if (index != markers.length) {
            markers[index].setMap(null);
            markers.splice(index, 1);
        } else {
            markers[index - 1].setMap(null);
            markers.splice(index - 1, 1);
        }
    }
    index = null;
};
function addPoint(event) {
    var minDist = 0;
    var minPlace;
    var midPt = [];

    for (var i = 0, I = markers.length; i < I; ++i) {
        currPos = markers[i].getPosition();
        nextPt = (i + 1 < I) ? i + 1: 0;
        nextPos = markers[nextPt].getPosition();
        midPt[i] = new google.maps.LatLng((currPos.lat() + nextPos.lat()) / 2, (currPos.lng() + nextPos.lng()) / 2);

        var currDistance = getDistance(event.latLng, midPt[i]);
        if (minDist == 0 || currDistance < minDist) {
            minDist = currDistance;
            minPlace = i;
        }
    }

    var marker = new google.maps.Marker({
        position: event.latLng,
        map: map,
        draggable: true,
        icon: markerIcon
    });
    var next = minPlace + 1;
    markers.splice(next, 0, marker);
    path.insertAt(next, event.latLng);

    google.maps.event.addListener(marker, 'click',
    function() {
        marker.setMap(null);
        for (var i = 0, I = markers.length; i < I && markers[i] != marker; ++i);
        markers.splice(i, 1);
        path.removeAt(i);
    }
    );

    google.maps.event.addListener(marker, 'dragend',
    function() {
        for (var i = 0, I = markers.length; i < I && markers[i] != marker; ++i);
        path.setAt(i, marker.getPosition());
    }
    );
}
/*
    Distance math.
*/
function rad(x) {
    return x * Math.PI / 180;
}
function getDistance(start, end) {
    //3959mi 6371km
    return 6731 * 2 * Math.asin(Math.sqrt(Math.pow(Math.sin((start.lat() - end.lat()) * Math.PI / 180 / 2), 2) + Math.cos(start.lat() * Math.PI / 180) * Math.cos(end.lat() * Math.PI / 180) * Math.pow(Math.sin((start.lng() - end.lng()) * Math.PI / 180 / 2), 2)));
}
