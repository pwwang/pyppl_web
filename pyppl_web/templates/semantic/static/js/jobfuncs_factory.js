(function($){

    var replace_button_text = function($button, text_to_replace) {
        var $icon = $button.children('i');
        $button.text(text_to_replace).prepend($icon);
    };

    var _one_type_of_proc_detail_to_trs = function(type, data_one) {
        var keys = Object.keys(data_one);
        if (keys.length == 0) {
            return '';
        }
        html = `
          <tr><td rowspan="${keys.length}">${type}</td>
              <td>${keys[0]}</td>
              <td>${data_one[keys[0]]}</td></tr>
        `
        for (var key in data_one) {
            if (key == keys[0]) {
                continue;
            }
            html += `<tr><td>${key}</td><td>${data_one[key]}</td></tr>`
        }
        return html;
    };

    var proc_detail_to_table = function(data) {
        var html = `
          <table class="ui celled structured proc-detail compact teal table">
            <thead>
              <tr><th>Type</th><th>Name</th><th>Value</th></tr>
            </thread>
            <tbody>
        `;
        if ('props' in data) {
            html += _one_type_of_proc_detail_to_trs('props', data.props);
        }
        if ('args' in data) {
            html += _one_type_of_proc_detail_to_trs('args', data.args);
        }
        if ('config' in data) {
            html += _one_type_of_proc_detail_to_trs('config', data.config);
        }
        if ('envs' in data) {
            html += _one_type_of_proc_detail_to_trs('envs', data.envs);
        }

        return html + `
            </tbody>
          </table>
        `;
    };

    class JobFunctions {
        constructor(proc, $wrapper, current_job_selector) {
            this.proc = proc;
            this.$wrapper = $wrapper;
            this.current_job_selector = current_job_selector;
            this.$main = $wrapper.find('.tab-main');

            this.first_button = this.$wrapper.find('.button.first');
            this.reset_rc_button = this.$wrapper.find('.button.jobrc');
            this.remove_lock_button = this.$wrapper.find('.button.remove-lock');
            this.proc_detail_button = this.$wrapper.find('.button.proc-detail');
            this.job_script_button = this.$wrapper.find('.button.job-script');
            this.show_stdout_button = this.$wrapper.find('.button.show-stdout');
            this.show_stderr_button = this.$wrapper.find('.button.show-stderr');
            this.list_jobdir_button = this.$wrapper.find('.button.list-jobdir');

            this.exclusive();
            this.listen();
        }

        exclusive() {
            var $buttons = this.$wrapper.find('.toggle.button');
            $buttons.click(function(){
                $buttons.removeClass('active');
                $(this).addClass('active');
            });
        }

        listen() {
            this.first_button.click( () => this.first() )
            this.reset_rc_button.on('rc-change', function() {
                var rc = $(this).text().replace('RC: ', '');
                if (rc == '0') {
                    $(this).removeClass('olive brown orange').addClass('olive');
                } else if (/^\d+$/.test(rc)) {
                    $(this).removeClass('olive brown orange').addClass('orange');
                } else {
                    $(this).removeClass('olive brown orange').addClass('brown');
                }
            } )
            this.reset_rc_button.click( () => this.reset_rc_ui() );
            this.remove_lock_button.click( () => this.remove_lock_ui() );
            this.proc_detail_button.click( () => this.proc_detail_ui() );
            this.job_script_button.click( () => this.job_script_ui() );
            this.show_stdout_button.click( () => this.show_logger_ui('job.stdout') );
            this.show_stderr_button.click( () => this.show_logger_ui('job.stderr') );
            this.list_jobdir_button.click( () => this.list_jobdir_ui() );
        }

        job_index() {
            return parseInt($(this.current_job_selector).text());
        }

        job_status() {
            var all_status = ['init', 'succeeded', 'failed', 'cached', 'running']
            for (var i in all_status) {
                if ($(this.current_job_selector).hasClass(all_status[i])) {
                    return(all_status[i]);
                }
            }
            return '';
        }

        _not_started() {
            if (this.job_status() === '') {
                this.$main.html('Job has not started yet.');
                return true;
            }
            return false;
        }

        _request_staying(data, selector, req_jobid=true, in_main=true) {
            // request to stay at current page when recieved response
            // otherwise we do nothing
            return ((!req_jobid || data.job == this.job_index()) &&
                    $(selector, in_main ? this.$main : 'body').is(':visible'));
        }

        list_jobdir_ui() {
            if (this._not_started()) {
                return;
            }
            var $filebrowser = $(`<div class="filebrowser"></div>`);
            this.$main.html($filebrowser);
            var that = this;
            $filebrowser.filebrowser({
                proc: that.proc,
                job: that.job_index(),
                request: function(download=false) {
                    window.socket.filetree_req({
                        proc: that.proc,
                        job: that.job_index(),
                        path: this.path,
                        type: this.type,
                        rootid: this.rootid,
                        download: download
                    });
                }
            });
        }

        show_logger_ui(type) {
            if (this._not_started()) {
                return;
            }
            var that = this;
            var logger = $(`<div class="${type} logger"></div>`)
                .appendTo(this.$main.html('')).logger({
                    request: function(reqlog) {
                        window.socket.logger_request({
                            proc: that.proc,
                            job: that.job_index(),
                            reqlog: reqlog,
                            eleid: this.id
                        })
                    }
                }).logger();

            logger.$header.find('.kill').before(`
                <div class="ui logger action form">
                    <div class="inline field">
                        <label>Action</label>
                        <select class="dropdown action" name="action">
                            <option value="head">head</option>
                            <option value="head -n20">head -n20</option>
                            <option value="head -n50">head -n50</option>
                            <option value="head -n100">head -n100</option>
                            <option selected value="tail">tail</option>
                            <option value="tail -n20">tail -n20</option>
                            <option value="tail -n50">tail -n50</option>
                            <option value="tail -n100">tail -n100</option>
                            <option value="tail -f">tail -f</option>
                            <option value="tail -f -n20">tail -f -n20</option>
                            <option value="tail -f -n50">tail -f -n50</option>
                            <option value="tail -f -n100">tail -f -n100</option>
                            <option value="cat">cat</option>
                        </select>
                    </div>
                </div>
            `);
            logger.$header.find('select.dropdown').on('change', function(){
                logger.init();
                window.socket.run_request({eleid: logger.id,
                                           proc: that.proc,
                                           job: that.job_index(),
                                           target: type,
                                           cmd: $(this).val()});
                logger.request('all');
            }).change();
        }

        job_script_resp(data) {
            if (!this._request_staying(data, '.editor')) {
                // we have switched procs or jobs
                return;
            }
            var jar = this.$main.find('.editor').codeeditor();
            jar.updateLang(data.lang);
            jar.updateCode(data.script);
            jar.updateOptions({tab: data.indent});
            this.$main.find('.ui.button.save,.ui.button.save-run')
                .removeClass('disabled');
        }

        job_script_req() {
            window.socket.job_script_req(
                {proc: this.proc, job: this.job_index()}
            );
        }

        job_script_run_req(eleid) {
            // # eleid: logger.id,
            // # proc: that.proc,
            // # job: that.job,
            // # target: type,
            // # cmd: $(this).val()});
            this.$main.find('.ui.button.save-run,.ui.button.run')
                .addClass('disabled');
            window.socket.run_request({
                proc: this.proc,
                job: this.job_index(),
                target: 'job.script',
                cmd: '',
                eleid: eleid
            });
            // should receive a response from the server if successfully running
            this.$main.find('.ui.button.log').click();
            setTimeout(
                () => $('#' + eleid).logger().request('all'),
                1
            );
        }

        job_script_save_resp(data) {
            this.$main.find('.ui.button.save-run,.ui.button.save')
                .removeClass('disabled');

            if (data.ok) {
                if (data.run) {
                    this.job_script_run_req(data.eleid)
                }
            } else if (this._request_staying(data)) {
                alert(`
                    Failed to save job.script for ${this.proc}/${this.job_index()}
                    ${data.msg}`
                );
            }
        }

        job_script_save_req(run=false, eleid=null) {
            // # proc: that.proc,
            // # job: that.job,
            // # script
            this.$main.find('.ui.button.save-run,.ui.button.save')
                .addClass('disabled');
            if (run) {
                this.$main.find('.ui.button.run').addClass('disabled')
            }

            window.socket.job_script_save_req({
                proc: this.proc,
                job: this.job_index(),
                script: this.$main.find('.editor').codeeditor().getCode(),
                run: run,
                eleid: eleid
            });
        }

        job_script_ui() {
            if (this._not_started()) {
                return;
            }
            var html = `
                <form class="ui form job-script">
                  <div class="field">
                    <div class="ui editor"></div>
                  </div>
                  <div class="field">
                    <button class="ui teal disabled button save" type="button">Save</button>
                    <button class="ui blue disabled button save-run" type="button">Save &amp; Run</button>
                    <button class="ui violet button run" type="button">Run</button>
                    <button class="ui button log" type="button">Show Log</button>
                  </div>
                  <div class="ui modal log">
                    <div class="scrolling content"></div>
                    <div class="actions">
                      <div class="ui close button cancel">Close</div>
                    </div>
                  </div>
                </form>
            `;
            this.$main.html(html);
            // 100% not working
            var height = this.$main.find('.editor').height();
            this.$main.find('.editor').height(height).codeeditor({
                init_code: 'Loading  ...'
            }).codeeditor();
            // .ui.modal.log will jump to body by semantic ui
            var that = this;
            var logger = this.$main.find(".ui.modal.log > .content").logger({
                request: function(reqlog) {
                    window.socket.logger_request({
                        proc: that.proc,
                        job: that.job_index(),
                        reqlog: reqlog,
                        eleid: this.id
                    })
                },
                require_stay: false,
                callback: function(status) {
                    if (status === 'done' || status === 'killed') {
                        that.$main.find('.ui.button.save-run,.ui.button.run')
                            .removeClass('disabled');
                    }
                }
            }).logger();
            logger.init();

            this.$main.find('.ui.button.log').click(() => {
                $('.ui.modal.log:has(#' + logger.id + ')').modal({
                    closable: false
                }).modal('show');
            });
            // send request to run job.script
            this.$main.find('.ui.button.run').click(
                // run the script
                () => this.job_script_run_req(logger.id)
            );

            this.$main.find('.ui.button.save').click(
                () => this.job_script_save_req()
            )

            this.$main.find('.ui.button.save-run').click(
                () => this.job_script_save_req(true, logger.id)
            )
            // request the content of job.script
            this.job_script_req();
            // request the running status of job.script
            // this.job_script_running_req();
        }

        proc_detail_resp(data) {
            if (!this._request_staying(data, '.ui.loading.proc-detail', false)) {
                return;
            }
            this.$main.children('div.loading')
                .removeClass('loading')
                .html(proc_detail_to_table(data));
        }

        proc_detail_req() {
            window.socket.proc_detail_req(this.proc)
        }

        proc_detail_ui() {
            this.$main.html('<div class="ui loading proc-detail"></div>');
            this.proc_detail_req();
        }

        first() {
            this.$main.html('Choose a function to start ...');
        }

        reset_rc_resp(data) {
            if (!this._request_staying(data, 'form.reset-rc')) {
                // we have switched procs or jobs
                return;
            }
            if (!this.reset_rc_button.hasClass('active')) {
                // we have switched functions
                return;
            }
            this.$main.children('form.reset-rc')
                .find('.field').removeClass('disabled');
            if (!data.ok) {
                replace_button_text(this.reset_rc_button, 'RC: ' +
                                    $(this.current_job_selector).attr('data-rc'));
                this.reset_rc_button.trigger('rc-change');
                this.$main.children('form.reset-rc')
                    .find('.ui.message')
                    .removeClass('hidden green teal')
                    .show()
                    .addClass('red')
                    .html('<i class="close icon"></i>' + data.msg);
            } else {
                replace_button_text(this.reset_rc_button, 'RC: ' + data.rc);
                this.reset_rc_button.trigger('rc-change');
                $(this.current_job_selector).attr('data-rc', data.rc)
                    .addClass('rc-changed');
                this.$main.children('form.reset-rc')
                    .find('.ui.message')
                    .show()
                    .removeClass('hidden red teal')
                    .addClass('green')
                    .html('<i class="close icon"></i>Reset!');
            }

        }

        reset_rc_req() {
            // send request
            var $form = this.$main.children('form.reset-rc');
            $form.find('.field').addClass('disabled');
            var rc = $form.find('input[name=jobrc]').val();
            var $msg = $form.find('.ui.message').removeClass('hidden').show();
            if (!/^[+-]?\d+$/.test(rc)) {
                $msg.addClass('red')
                    .html('<i class="close icon"></i>Invalid return code.');
                return;
            } else {
                $msg.addClass('teal')
                    .html('<i class="close icon"></i>Resetting ...');
            }
            replace_button_text(this.reset_rc_button, 'RC: ...');
            this.reset_rc_button.trigger('rc-change');
            window.socket.reset_rc_req({
                proc: this.proc,
                job: this.job_index(),
                rc: $form.find('input[name=jobrc]').val()
            });
        }

        reset_rc_ui() {
            if (this._not_started()) {
                return;
            }

            var jobidx = this.job_index();
            var rcform = `
                <form class="ui form reset-rc">
                  <div class="field">
                    <label>Reset return code of job #${jobidx} to:</label>
                    <input type="text" name="jobrc" placeholder="">
                  </div>
                  <div class="field">
                    <button class="ui button" type="button">Submit</button>
                  </div>
                  <div class="ui hidden message ">
                    <i class="close icon"></i>
                  </div>
                </form>
            `;
            this.$main.html(rcform);
            this.$main.children('form.reset-rc')
                .on('submit', () => false)
                .on('click', '.field:not(.disabled) > .button',
                    () => this.reset_rc_req());
        }

        remove_lock_resp(data) {
            if (!this._request_staying(data, 'form.remove-lock', false)) {
                return;
            }
            this.$main.children('form.remove-lock')
                .find('.field').removeClass('disabled');
            if (!data.ok) {
                this.$main.children('form.remove-lock')
                    .find('.ui.message')
                    .removeClass('hidden green teal')
                    .show()
                    .addClass('red')
                    .html('<i class="close icon"></i>' + data.msg);
            } else {
                this.$main.children('form.remove-lock')
                    .find('.ui.message')
                    .removeClass('hidden red teal')
                    .show()
                    .addClass('green')
                    .html('<i class="close icon"></i>Removed!');
            }
        }

        remove_lock_req() {
            var $form = this.$main.children('form.remove-lock');
            $form.find('.field').addClass('disabled');
            var $msg = $form.find('.ui.message').removeClass('hidden').show();
            $msg.addClass('teal')
                .html('<i class="close icon"></i>Removing ...');
            window.socket.remove_lock_req({
                proc: this.proc
            });
        }

        remove_lock_ui() {
            var jobidx = this.job_index();
            var rlform = `
                <form class="ui form remove-lock">
                  <div class="field">
                    <label>Are you sure to remove the lock file of this process?</label>
                    <button class="ui button" type="button">Yes</button>
                  </div>
                  <div class="ui hidden message ">
                    <i class="close icon"></i>
                  </div>
                </form>
            `;
            this.$main.html(rlform);
            this.$main.children('form.remove-lock').on(
                'click', '.field:not(.disabled) > .button',
                () => this.remove_lock_req()
            );
        }
    }

    window.JobFunctions = JobFunctions;
})(jQuery);
