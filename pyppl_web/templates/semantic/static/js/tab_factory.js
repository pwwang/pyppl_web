(function($){

    var jobdata_to_lists = function(jobdata, len, offset=0) {
        // jobdata ==> jobindex: [status, rc]
        var lists = '';
        for (var i in [...Array(len).keys()]) {
            i = parseInt(i)
            i += offset;
            var classes = '';
            var job_rc = '';
            if (jobdata[i] !== undefined) {
                classes = jobdata[i][0];
                job_rc = jobdata[i][1];
            }
            lists += '  <li class="job ' + classes +'" '+
                     '      data-rc="'+ job_rc +'">'+ (i+1) +
                     '  </li>\n';
        }
        return lists;
    };

    var replace_button_text = function($button, text_to_replace) {
        var $icon = $button.children('i');
        $button.text(text_to_replace).prepend($icon);
    };

    class JobFunctions {
        constructor(proc, $wrapper, current_job_selector) {
            this.proc = proc;
            this.$wrapper = $wrapper;
            this.current_job_selector = current_job_selector;
            this.$main = $wrapper.find('.tab-main');

            this.reset_rc_button = this.$wrapper.find('.button.reset-rc');
            this.remove_lock_button = this.$wrapper.find('.button.remove-lock');

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
            var that = this;
            this.reset_rc_button.click( () => that.reset_rc_ui() );
            this.remove_lock_button.click( () => that.remove_lock_ui() );
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
            if (this.job_status() == '') {
                this.$main.html('Job has not started yet.');
                return true;
            }
            return false;
        }

        reset_rc_resp(data) {
            if (data.job != this.job_index()) {
                // we have switched jobs
                return;
            }
            if (!this.reset_rc_button.hasClass('active')) {
                // we have switched functions
                return;
            }
            if (!data.ok) {
                replace_button_text(this.reset_rc_button, 'RC: ' +
                                    $(this.current_job_selector).attr('data-rc'));
                this.$main.children('form.reset-rc')
                    .find('.ui.message')
                    .removeClass('hidden green teal')
                    .show()
                    .addClass('red')
                    .html('<i class="close icon"></i>' + data.msg);
            } else {
                replace_button_text(this.reset_rc_button, 'RC: ' + data.rc);
                $(this.current_job_selector).attr('data-rc', data.rc);
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
            $form.find('field').addClass('disabled');
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
                  <div class="field>
                    <button class="ui button" type="button">Submit</button>
                  </div>
                  <div class="ui hidden message ">
                    <i class="close icon"></i>
                  </div>
                </form>
            `;
            this.$main.html(rcform);
            var that = this;
            this.$main.children('form.reset-rc').on(
                'click', '.field:not(.disabled) > .button', function(){
                that.reset_rc_req();
            });
        }

        remove_lock_resp(data) {
            if (!this.remove_lock_button.hasClass('active')) {
                // we have switched functions
                return;
            }
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
            $form.find('field').addClass('disabled');
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
            var that = this;
            this.$main.children('form.remove-lock').on(
                'click', '.field:not(.disabled) > .button', function(){
                that.remove_lock_req();
            });
        }
    }

    class Tab {
        constructor($header) {
            this.$header = $header;
            this.$header.children(".item").tab();
            this.cached = {};

        }
        added(name) {
            return this.$header.children('[data-tab="' + name + '"]').length > 0;
        }
        _add_from_cache(name) {
            this.cached[name].header.show();
            this.cached[name].content.show();
        }
        _add_tab(name) {
            var header = $('<div class="item" data-tab="' + name + '">' + name +
                '<i class="close icon ui"></i></div>');
            var content = $('<div class="ui bottom attached tab segment" data-tab="' + name + '"></div>');
            this.cached[name] = { header: header, content: content };
            this.$header.after(content);
            this.$header.append(header);
            var that = this;
            header
                .tab({
                    onFirstLoad: function() {
                        window.socket.tab_proc_init_req(name);
                    }
                })
                // causing tab content overflow
                // .qtip({
                //     content: 'Double-click to destroy.',
                //     position: {my: 'top center',
                //                at: 'bottom center'},
                //     show: {solo: true},
                //     style: {classes: 'qtip-tipsy'}
                // })
                .on('dblclick', (e) => {
                    e.stopPropagation(); // don't trigger tab switching here.
                    that.delete(name, true);
                })
                .children("i.close")
                .on("click", (e) => {
                    e.stopPropagation();
                    that.delete(name);
                });
        }
        _get_tab(name) {
            var header = this.$header.children('[data-tab="' + name + '"]');
            var content = this.$header.siblings('[data-tab="' + name + '"]');
            return { header: header, content: content };
        }
        delete(name, delete_cache = false) {
            var tab = this._get_tab(name);
            if (delete_cache) {
                tab.header.remove();
                tab.content.remove();
                delete this.cached[name];
                window.socket.tab_proc_destroyed(name);
            }
            else {
                tab.header.hide();
                tab.content.hide();
            }
            this.$header.children(".item:first").click();
        }

        jobfuncs(name) {
            return this.cached[name] === undefined ? undefined : this.cached[name].jobfuncs
        }

        init_tab(name, data) {
            var tab = this._get_tab(name);
            if (tab.header.length == 0) {
                return;
            }
            // init an empty one without data
            var html = `
              <div class="ui fullheight">
                <div class="ui left visible sidebar">
                  <h3 class="ui header">
                    <i class="tasks icon"></i>
                    <div class="content">Jobs</div>
                  </h3>
                  <div class="ui jobs"></div>
                </div>
                <div class="ui tab-main-wrapper fullheight">
                  <div class="ui tab-tools html top attached segment">
                    <div class="ui buttons top attached">
                      <button class="ui toggle button active first"><i class="tag icon"></i>Job: </button>
                      <button class="ui toggle button jobrc"><i class="random icon"></i>RC: </button>
                      <button class="ui toggle button list-jobdir"><i class="suitcase icon"></i>List Jobdir</button>
                      <button class="ui toggle button list-indir"><i class="folder icon"></i>List Indir</button>
                      <button class="ui toggle button list-outdir"><i class="folder outline icon"></i>List Outdir</button>
                    </div>
                    <div class="ui buttons attached">
                      <button class="ui toggle button proc-detail"><i class="list alternate icon"></i>Proc Detail</button>
                      <button class="ui toggle button full-stdout"><i class="file outline icon"></i>Full Stdout</button>
                      <button class="ui toggle button tail-stdout"><i class="file alternate outline icon"></i>Tail Stdout</button>
                      <button class="ui toggle button full-stderr"><i class="file icon"></i>Full Stderr</button>
                      <button class="ui toggle button tail-stderr"><i class="file alternate icon"></i>Full Stderr</button>
                    </div>
                    <div class="ui buttons bottom attached">
                      <button class="ui toggle button job-script"><i class="pencil alternate icon"></i>Show job.script</button>
                      <button class="ui toggle button run-script"><i class="shipping fast icon"></i>Run job.script</button>
                      <button class="ui toggle red button remove-lock"><i class="x icon"></i>Remove Lock</button>
                    </div>
                  </div>
                  <div class="ui tab-main bottom attached segment">
                    Choose a function to start ...
                  </div>
                </div>
              </div>
            `
            tab.content.html(html);
            this.cached[name].jobfuncs = new JobFunctions(name, tab.content,
                                                          '.ui.jobs .job.current');

            if (data.status == '') {
                tab.content.find('.ui.tab-main').html('Process not started yet.');
            } else {
                // load jobs
                var jobs_html = '<ul class="jobs-ul">\n';
                jobs_html += jobdata_to_lists(data.jobs, Math.min(100, data.size));
                if (data.size > 100) {
                    jobs_html += '  <li class="load-more">Load More</li>\n'
                    jobs_html += '  <li class="load-more load-all">Load All</li>\n'
                }
                jobs_html += '</ul>\n';

                tab.content.find(".ui.jobs").html(jobs_html)
                    .on('click', '.job', function(){
                        if (!$(this).hasClass('current')) {
                            // we are switching jobs, reset current tool
                            $(this).siblings('.job').removeClass('current')
                                .end().addClass('current');

                            replace_button_text(
                                tab.content.find('.button.first'),
                                'Job: ' + $(this).text()
                            );
                            replace_button_text(
                                tab.content.find('.button.jobrc'),
                                'RC: ' + $(this).attr('data-rc')
                            );
                        }
                    })
                    .find('.job:first').click().end()
                    .find('.load-more')
                    .on('click', function(){
                        var loaded = $(this).siblings('.job').length;
                        var next_to_load = data.size - loaded;
                        if (!$(this).hasClass('load-all')) {
                            next_to_load = Math.min(next_to_load, 100);
                        }
                        jobs_html = jobdata_to_lists(data.jobs, next_to_load, loaded);
                        if ($(this).hasClass('load-all')) {
                            $(this).prev().before(jobs_html);
                        } else {
                            $(this).before(jobs_html);
                        }
                        if (loaded + next_to_load >= data.size) {
                            $(this).siblings('.load-more').addBack().remove();
                        }
                    });
            }
        }
        job_status_change(name, data) {
            var tab = this._get_tab(name);
            if (!tab.content.is(':visible')) {
                return;
            }
            var jobidx = data.job;
            var $job = tab.content.find('li.job:eq('+ jobidx +')');
            $job.removeClass('init succeeded cached failed running')
                .addClass(data.status)
                .attr('data-rc', data.rc);
            if ($job.hasClass('current')) {
                replace_button_text(tab.content.find('.button.jobrc'),
                                    'RC: ' + data.rc);
            }
        }
        focus(name) {
            var tab = this._get_tab(name);
            tab.header.click();
        }
        add(name, cache = true) {
            if (name in this.cached && cache) {
                this._add_from_cache(name);
            }
            else {
                this._add_tab(name);
            }
            return this;
        }
    }

    window.Tab = Tab;
})(jQuery);
