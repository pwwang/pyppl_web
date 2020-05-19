(function($) {

    var PYPPL_ELEMENT_INDEX = 0;

    TYPE_ICON_MAPPING = {
        image: 'file image',
        python: 'python',
        bash: 'code',
        fish: 'code',
        r: 'chart line',
        pdf: 'file pdf',
        stdout: 'file alternate',
        stderr: 'file alternate red'
    }

    class FileTreeItem {
        constructor($obj, data, request, $view, rootid) {
            // add unique id to this $obj, so that later this can be retrieved
            this.request = request;
            this.status = '';
            this.$view = $view;
            this.type = data.type;
            this.rootid = rootid;

            var $wrapper = $(`
                <div class="item">
                    <i class="icon"></i>
                    <div class="content">
                        <div class="header">${data.name}</div>
                    </div>
                </div>
            `);

            $obj.append($wrapper);
            this.$header = $wrapper.find(`.header`);
            this.$icon = $wrapper.find(`.icon`);
            this.path = data.path;

            var icon = TYPE_ICON_MAPPING[data.type] || 'file';
            this.$icon.addClass(icon);

            this.listen();
        }

        listen() {
            this.$header.on(
                'click',
                () => this.toggle()
            );
        }

        _operations() {
            var html = `
                <div class="ui operations buttons"></div>
                <div class="ui previewer"></div>
            `;
            this.$view.html(html);
            this.status = 'operations'
        }

        _preview() {
            this.$view.children('.ui.previewer').addClass('loading');
            this.request.apply(this);
            this.status = 'preview'
        }

        response(data) {
            if (data.type == 'image') {
                this.$view.children('.ui.previewer').html(`
                    <img src="${data.content}" />
                `)
            } else if (data.type in ['python', 'bash', 'fish', 'r']) {
                var $codeeditor = $(`<div class="ui editor ${data.type}"></div>`);
                this.$view.html($codeeditor);
                var editor = $codeeditor.codeeditor({}).codeeditor();
                editor.updateCode(data.content);
                editor.updateLang(data.type);
            } else if (data.type === false) {
                this.$view.html(`
                    <div class="ui red message">
                        Preview not supported, download it and view it locally.
                    </div>
                `);
            } else {
                var $log = $(`<div class="ui code logger"></div>`);
                this.$view.html($log);
                var logger = $log.logger({}).logger();
                logger.$header.hide();
                logger.response({isrunning: 'done', reqlog: 'all', log: data.content});
            }
        }

        toggle() {
            if (this.status === '') {
                this.status = 'operations';
                this._operations();
            } else if (this.status === 'operations') {
                this.status = 'preview';
                this._preview();
            }
        }
    }

    class FileTreeFolder extends FileTreeItem {
        constructor($obj, data, request, $view, rootid) {
            super($obj, data, request, $view, rootid);

            this.status = 'collapsed';
            this.$header.after(`<div class="list"></div>`);
            this.$content = this.$header.next('.list');
            this.type = 'folder';
            this.children = {};
        }

        response(data) {
            // append content/children
            this.$icon.removeClass('spinner').addClass('folder open')

            for (var item of data.content) {
                var child = new (item.type == 'folder' ? FileTreeFolder : FileTreeItem)(
                    this.$content,
                    item,
                    this.options.request,
                    this.$view
                );
                this.children[item.name] = child;
            }
        }

        toggle() {
            if (this.status == 'collapsed') {
                this.$content.show();
                if (this.$content.is(':empty')) {
                    // send request
                    this.$icon.removeClass('folder open').addClass('spinner');
                    this.request.apply(this);
                }
            } else {
                this.$icon.removeClass('spinner open').addClass('folder');
                this.$content.hide();
            }
        }
    }

    class FileBrowser {
        constructor($obj, options) {
            this.id = 'pyppl-web-' + (++PYPPL_ELEMENT_INDEX);
            $obj.attr('id', this.id);
            this.options = options;
            $obj.addClass("ui two column grid");
            this.$treeview = $(`
                <div class="column filetree disabled ui list">Loading ...</div>
            `).appendTo($obj);
            this.$fileview = $(`
                <div class="column fileview"></div>
            `).appendTo($obj);

            this.children = {};
            this.path = '';
            this.type = 'folder';
            this.rootid = this.id;

            this._init_req();
        }

        _init_req() {
            this.options.request.apply(this);
        }

        response(data) {
            console.log(data)
            // [{type: folder, path:..., name: ...}, ...]
            this.$treeview.html('');
            for (var item of data.content) {
                var child = new (item.type == 'folder' ? FileTreeFolder : FileTreeItem)(
                    this.$treeview,
                    item,
                    this.options.request,
                    this.$fileview,
                    this.id
                )
                this.children[item.name] = child;
            }
        }
    }

    class Logger {
        constructor($obj, options) {
            this.id = 'pyppl-web-' + (++PYPPL_ELEMENT_INDEX);
            $obj.attr('id', this.id);
            this.status = false;
            this.options = options;
            this.$header = $(`
                <div class="ui two column grid">
                    <div class="column status left"><strong>Status: </strong></div>
                    <div class="column actions right">
                        <button class="ui red button disabled kill">Kill</button>
                    </div>
                </div>`
            ).appendTo($obj);
            this.$main = $(`<div class="code"></div>`).appendTo($obj);

            this.$header.find('.ui.button.kill').on('click', () => {
                this.status_change('killing');
                setTimeout(
                    () => this.request('kill'),
                    this.options.req_interval
                );
            });
        }

        init() {
            this.status = null;
            this.status_change(false);
            this.$main.html('<p class="return">Loading ...</p>');
            this.options.callback && this.options.callback.call(this, 'init');
        }

        status_change(new_status, pid=null) {
            if (new_status === true) {
                this.$header.find('.column.status').html(`
                    <strong>Status: </strong> running (PID: ${pid})
                `);

                this.$header.find('.ui.button.kill')
                    .removeClass('disabled').text('Kill');

                if (this.status !== 'killing') {
                    setTimeout(
                        ()  => this.request('more'),
                        this.options.req_interval
                    );
                }
                if (this.options.callback && this.status !== true) {
                    this.options.callback.call(this, 'running');
                }
                this.status = new_status;
                return;
            }
            if (this.status === new_status) {
                return;
            }
            this.$header.find('.column.status').html(
                '<strong>Status: </strong>' +
                    (new_status === false ? 'not running' : new_status)
            );
            if (new_status === 'killing') {
                this.$header.find('.ui.button.kill').addClass('disabled').text('Killing');
            } else {
                this.$header.find('.ui.button.kill').addClass('disabled').text('Kill');
            }

            if (this.options.callback) {
                this.options.callback.call(this, new_status);
            }
            this.status = new_status;
        }

        request(reqlog) {
            this.options.request.call(this, reqlog);
        }

        _append(line) {
            var $lastp = this.$main.find('p:last');
            if ($lastp.hasClass('.return')) {
                $lastp.remove();
            }
            if (/\r$/.test(line)) {
                this.$main.append(`<p class="return">${line}</p>`)
            } else {
                this.$main.append(`<p>${line}</p>`)
            }
        }

        response(data) {
            // data should have all data in request
            // data.log: the message got to show
            // data.isrunning: whether the process is still running
            // data.reqlog: requested more or all
            // data.pid
            if (this.options.require_stay && !this.$main.is(':visible')) {
                this.status = data.is_running;
                return;
            }
            if (data.reqlog == 'all') {
                this.$main.html('');
                data.reqlog = 'more';
                this.response(data);
            } else {
                this.status_change(data.isrunning, data.pid);
                if (data.log.length) {
                    var lines = data.log.match(/.+?(?:\r\n|\r|\n)/g);
                    for (var line of lines) {
                        this._append(line);
                    }
                }
            }
        }
    }

    class CodeEditor {

        constructor($obj, options) {
            this.id = 'pyppl-web-' + (++PYPPL_ELEMENT_INDEX);
            $obj.attr('id', this.id);
            this.$obj = $obj;
            var highlight = (editor) => {
                // highlight.js does not trims old tags,
                // let's do it by this hack.
                editor.textContent = editor.textContent
                hljs.highlightBlock(editor)
            };
            if (options.lang) {
                $obj.addClass(options.lang);
            }

            var init_code = '';
            if (options.init_code) {
                init_code = options.init_code;
                delete options.init_code;
            }

            this.editor = new CodeJar($obj[0],
                                      codeJarWithLineNumbers(highlight),
                                      options);
            this.updateCode(init_code);
        }

        updateCode(code) {
            this.editor.updateCode(code);
        }

        updateOptions(options) {
            this.editor.updateOptions(options);
        }

        updateLang(lang) {
            this.$obj.addClass(lang);
        }

        getCode() {
            return this.editor.toString();
        }

    }

    $.fn.logger = function(options) {
        // a logger that show realtime output or stderrs
        if (typeof options === 'object') {
            options.req_interval = options.req_interval || 1.0;
            options.require_stay = options.require_stay === undefined ? true : options.require_stay;
            var logger = new Logger(this, options);
            this.data('pyppl_web:logger', logger);
        } else {
            return this.data('pyppl_web:logger');
        }
        return this;
    }

    $.fn.filebrowser = function(options) {
        if (typeof options === 'object') {
            var filebrowser = new FileBrowser(this, options);
            this.data('pyppl_web:filebrowser', filebrowser);
        } else {
            return this.data('pyppl_web:filebrowser');
        }
        return this;
    }

    $.fn.codeeditor = function(options) {
        if (typeof options === 'object') {
            var codeeditor = new CodeEditor(this, options);
            this.data('pyppl_web:codeeditor', codeeditor);
        } else {
            return this.data('pyppl_web:codeeditor');
        }
        return this;
    }

})(jQuery);
