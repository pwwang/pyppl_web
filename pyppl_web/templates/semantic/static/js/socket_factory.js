(function(){

    var socket_factory = function($, socket) {
        socket.on('connect', function(){
            console.log('Connected to server.')
            console.log('Emitting init_req')
            socket.emit('init_req')
        });

        socket.on('init_resp', function(data) {
            $("#pipeline_name").text(data.name);
        });
    };

    window.socket_factory = socket_factory;

})();
