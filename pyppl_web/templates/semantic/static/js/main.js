
(function($){
    // connect earlier
    var socketio = io();
    $(document).ready(function(){

        window.tab = new window.Tab($("#header"));
        delete window.Tab

        var socket = window.socket = new window.Socket(socketio);
        socket.listen();
        delete window.Socket;

        $('body').on('click', 'i.close.icon', function(){
            $(this).parent().hide();
        });
    });
})(jQuery);
