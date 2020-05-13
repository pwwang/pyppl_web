(function(){
    var Tab = function($, $header) {
        this.$ = $;
        this.$header = $header;
        this.$header.children(".item").tab();
        this.cached = {};
    };

    Tab.prototype.added = function(name) {
        return this.$header.children('[data-tab="'+ name +'"]').length > 0;
    };

    Tab.prototype._add_from_cache = function(name) {
        this.cached[name].header.show();
        this.cached[name].content.show();
    };

    Tab.prototype._add_tab = function(name) {
        var header = this.$('<div class="item" data-tab="'+ name +'">'+ name +
                            '<i class="close icon"></i></div>');
        var content = this.$('<div class="ui bottom attached tab segment" data-tab="'+ name +'"></div>');
        this.cached[name] = {header: header, content: content};
        this.$header.append(header);
        this.$header.after(content);
        var that = this;
        header.children("i.close").on("click", function(){
            that.delete(name);
        });
    };

    Tab.prototype._get_tab = function(name) {
        var header = this.$header.children('[data-tab="'+ name +'"]');
        var content = this.$header.siblings('[data-tab="'+ name +'"]');
        return {header: header, content: content};
    }

    Tab.prototype.delete = function(name, delete_cache=false) {
        var tab = this._get_tab(name);
        if (delete_cache) {
            tab.header.remove();
            tab.content.remove();
            delete this.cached[name];
        } else {
            tab.header.hide();
            tab.content.hide();
        }
    };

    Tab.prototype.focus = function(name) {
        var tab = this._get_tab(name);
        tab.header.click();
    };

    Tab.prototype.add = function(name, cache=true) {
        if (name in this.cached && cache) {
            this._add_from_cache(name)
        } else {
            this._add_tab(name)
        }
    };

    window.tab_factory = Tab;
})();
