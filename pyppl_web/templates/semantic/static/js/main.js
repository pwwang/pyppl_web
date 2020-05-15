
(function($){
    // connect earlier
    var socketio = io();
    $(document).ready(function(){

        var tab = window.tab = new window.Tab($("#header"));
        delete window.Tab

        var socket = window.socket = new window.Socket(socketio);
        socket.listen();
        delete window.Socket;
    });
})(jQuery);
