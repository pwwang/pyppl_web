(function($){

    class Socket {
        constructor(socket) {
            this.socket = socket;
        }

        listen() {
            this.socket.on('connect', () => {this.connect()});
            this.socket.on('disconnect', () => {this.disconnect()});
            this.socket.on('init_resp', (data) => {this.init_resp(data)});
            this.socket.on('pipeline_update',
                           (data) => {this.pipeline_update(data)});
            this.socket.on('tab_proc_init_resp',
                           (data) => {this.tab_proc_init_resp(data)});
            this.socket.on('job_status_change',
                           (data) => {this.job_status_change(data)});
            this.socket.on('reset_rc_resp',
                           (data) => {this.reset_rc_resp(data)});
            this.socket.on('remove_lock_resp',
                           (data) => {this.remove_lock_resp(data)});
            this.socket.on('proc_detail_resp',
                           (data) => {this.proc_detail_resp(data)});
            this.socket.on('job_script_resp',
                           (data) => {this.job_script_resp(data)});
            this.socket.on('job_script_running_resp',
                           (data) => {this.job_script_running_resp(data)});
        }

        connect() {
            console.log('Connected to server.');
            console.log('Emitting init_req');
            this.socket.emit('init_req');
        }

        disconnect() {
            console.log('Disconnected from server.')
            if (window.confirm('Disconnected from server, reload the page?')) {
                window.location.reload();
            }
        }

        proc_detail_req(proc) {
            console.log('Emitting proc_detail_req');
            this.socket.emit('proc_detail_req', {proc: proc});
        }

        proc_detail_resp(data) {
            console.log('Received proc_detail_resp for ' + data.proc);
            var jobfuncs = window.tab.jobfuncs(data.proc);
            if (jobfuncs !== undefined) {
                jobfuncs.proc_detail_resp(data);
            }
        }

        tab_proc_init_req(proc) {
            console.log('Emitting tab_proc_init_req');
            this.socket.emit('tab_proc_init_req', {proc: proc});
        }

        tab_proc_init_resp(data) {
            console.log('Received tab_proc_init_resp for ' + data.proc);
            window.tab.init_tab(data.proc, data);
        }

        tab_proc_destroyed(proc) {
            console.log('Tab of ' + proc + 'destroyed, stop receiving response');
            this.socket.emit('tab_proc_destroyed', {proc: proc});
        }

        job_status_change(data) {
            window.tab.job_status_change(data.proc, data);
        }
        reset_rc_req(data) {
            this.socket.emit('reset_rc_req', data);
        }
        reset_rc_resp(data) {
            var jobfuncs = window.tab.jobfuncs(data.proc);
            if (jobfuncs !== undefined) {
                jobfuncs.reset_rc_resp(data);
            }
        }
        remove_lock_req(data) {
            this.socket.emit('remove_lock_req', data);
        }
        remove_lock_resp(data) {
            var jobfuncs = window.tab.jobfuncs(data.proc);
            if (jobfuncs !== undefined) {
                jobfuncs.remove_lock_resp(data);
            }
        }

        job_script_resp(data) {
            var jobfuncs = window.tab.jobfuncs(data.proc);
            if (jobfuncs !== undefined) {
                jobfuncs.job_script_resp(data);
            }
        }
        job_script_req(data) {
            console.log('Emitting job_script_req');
            this.socket.emit('job_script_req', data);
        }
        job_script_running_resp(data) {
            var jobfuncs = window.tab.jobfuncs(data.proc);
            if (jobfuncs !== undefined) {
                jobfuncs.job_script_running_resp(data);
            }
        }
        job_script_running_req(data) {
            console.log('Emitting job_script_running_req');
            this.socket.emit('job_script_running_req', data);
        }

        job_script_run_req(data) {
            console.log('Emitting job_script_run_req');
            this.socket.emit('job_script_run_req', data);
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
            }
        }

        pipeline_update(data) {
            // proc: procid, size: # jobs
            // update in graph
            console.debug('Recieved pipeline_update for '+ data.proc);
            if (window.cyto === undefined) {
                console.debug('Cytoscape not initialized yet, try it.')
                // graph not init'ed, let redo it
                this.socket.emit('init_req');
            } else {
                window.cyto.pipeline_update(data);
            }
        }
    }

    window.Socket = Socket;

})(jQuery);
