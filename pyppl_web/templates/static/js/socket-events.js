// expose this global var
var socket = io();

(function(socket) {
    socket.on('connect', function(){
        console.log('Connected to server.')
        console.log('Emitting init_req')
        socket.emit('init_req')
    });

    socket.on('init_resp', function(data) {
        console.log(data)
    });
})(socket);

window.socket = socket;
