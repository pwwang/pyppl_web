
(function($){
    var socket = io();
    $(document).ready(function(){
        socket_factory($, socket);
        new tab_factory($, $("#header"));

    });
})(jQuery);
