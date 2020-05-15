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
            }
            else {
                tab.header.hide();
                tab.content.hide();
            }
            this.$header.children(".item:first").click();
        }

        init_tab(name, data) {
            var tab = this._get_tab(name);
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
                  <div class="ui tab-tools html top attached segment buttons">
                    <button class="ui button active first">Job: [RC=]</button>
                    <button class="ui button">Show STDOUT</button>
                    <button class="ui button">Tail STDOUT</button>
                    <button class="ui button">Show STDERR</button>
                    <button class="ui button">Tail STDERR</button>
                    <button class="ui button">List indir</button>
                    <button class="ui button">List outdir</button>
                    <button class="ui red button">Remove Lock</button>
                  </div>
                  <div class="ui tab-main bottom attached segment">
                    Choose a function to start ...
                  </div>
                </div>
              </div>
            `
            tab.content.html(html);
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
                            tab.content.find('.button.first')
                                .text('Job: ' + $(this).text() +
                                      ' [RC='+ $(this).attr('data-rc') +']')
                                .click();
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
                            $(this).siblings('load-more').addSelf().remove();
                        }
                    });
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
