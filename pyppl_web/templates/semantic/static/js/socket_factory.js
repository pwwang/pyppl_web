(function($){

    class Socket {
        constructor(socket) {
            this.socket = socket;

        }

        listen() {
            var that = this;
            this.socket.on('connect', () => {that.connect()});
            this.socket.on('init_resp', (data) => {that.init_resp(data)});
            this.socket.on('pipeline_update',
                           (data) => {that.pipeline_update(data)});
            this.socket.on('tab_proc_init_resp',
                           (data) => {that.tab_proc_init_resp(data)});
        }

        connect() {
            console.log('Connected to server.');
            console.log('Emitting init_req');
            this.socket.emit('init_req');
        }

        tab_proc_init_req(proc) {
            console.log('Emitting tab_proc_init_req');
            this.socket.emit('tab_proc_init_req', {proc: proc});
        }

        tab_proc_init_resp(data) {
            console.log('Received tab_proc_init_resp for ' + data.proc)
            window.tab.init_tab(data.proc, data);
        }

        init_resp(data) {
            // initialize the graph as well as the cytoscape from factory
            console.debug('Received init_resp.');
            $(document).prop('title',
                             'Pipeline: ' + data.name + ' - pyppl_web');
            $("#pipeline_name").text(data.name);

            if (window.cyto === undefined) {
                // assemble the graph using cytoscape.js
                var cyto = window.cyto = new window.Cyto($("#cytoscape"))
                cyto.assemble(data).ready();
                delete window.Cyto;
            } else {
                // reload the page
                if (window.confirm('Pipeline restarted, reload the page?')) {
                    window.location.reload();
                }
            }
        }

        pipeline_update(data) {
            // proc: procid, size: # jobs
            // update in graph
            console.debug('Recieved pipeline_update for '+ data.proc);
            window.cyto.pipeline_update(data);
        }
    }

    window.Socket = Socket;

})(jQuery);
