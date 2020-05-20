// in case we need to send requests
(function($){
    const NODE_CLASSES = {
        mixed: 'mixed_nodes',
        start: 'start_nodes',
        end: 'end_nodes',
        hidden: 'hidden_nodes',
        group: 'group'
    };

    const CY_STYLES = [{
        selector: 'node',
        style: {'content': 'data(label)',
                'width': 100,
                'height': 30,
                'shape': 'round-rectangle',
                'border-width': 2,
                'border-style': 'solid'}
    }, {
        selector: 'node[status]',
        style: {'text-valign': 'center'}
    }, {
        selector: '.mixed_nodes',
        style: {'border-color': '#8a771d'}
    }, {
        selector: '.start_nodes',
        style: {'border-color': '#1d8a34'}
    }, {
        selector: '.end_nodes',
        style: {'border-color': '#8a681d'}
    }, {
        selector: '.hidden_nodes',
        style: {'border-color': '#a9a9a9'}
    }, {
        selector: '.group',
        style: {'background-opacity': 0.5,
                'background-color': '#e2e6ff',
                "text-valign": "center",
                "text-halign": "left",
                'border-width': 0}
    }, {selector: 'edge',
        style: {'width': 2,
                'target-arrow-shape': 'triangle',
                'line-color': '#999',
                'curve-style': 'bezier',
                'target-arrow-color': '#999'}
    }];

    const PBAR_COLORS = {
        failed: '#eaacbd', // light red
        cached: '#aceae2', // light cyan
        succeeded: '#c3fdb5', // light green
        init: '#c3fdb5',
        '': 'white',
    };

    class Cyto {
        constructor($wrapper) {
            this.$wrapper = $wrapper;
            this.cyto = cytoscape({
                container: $wrapper,
                zoomingEnabled: false,
                pan: {x: $(window).width()/2, y: 50},
                style: CY_STYLES
            });

            var that = this;
            $(`<select class="cyto-exporter">
                  <option value=''>Export flowchart as ...</option>
                  <option value='png'>PNG</option>
                  <option value='jpg'>JPG</option>
                  <option value='json'>JSON</option>
               </select>`).prependTo('#cytoscape').dropdown({
                   onChange: function(value) {
                        if (value === '') {
                            return;
                        }
                        if (value === 'jpg' || value === 'png') {
                            var url = that.cyto[value]();
                        } else {
                            var blob = new Blob(
                                [JSON.stringify(that.cyto.json())],
                                {type: 'application/json'}
                            );
                            var url = URL.createObjectURL(blob);
                        }
                        var a = document.createElement("a");
                        a.href = url;
                        a.download = $('#pipeline_name').text() + '.' + value;
                        a.click();
                    }
               }).parent('.selection.ui.dropdown').addClass('cyto-exporter');
        }

        _add_node_class(node) {
            node.classes = node.classes || [];
            if (node.data.is_start === true && node.data.is_end === true) {
                node.classes.push(NODE_CLASSES.mixed);
            } else if (node.data.is_start === true) {
                node.classes.push(NODE_CLASSES.start);
            } else if (node.data.is_end === true) {
                node.classes.push(NODE_CLASSES.end)
            }
            if (node.data.is_hidden === true) {
                node.classes.push(NODE_CLASSES.hidden);
            }
            return(node);
        }

        assemble(data) {
            for (var group in data.nodes) {
                if (group != "PYPPL_ROOTGROUP") {
                    this.cyto.add({group: 'nodes',
                                   data: {id: group, label: group},
                                   classes: [NODE_CLASSES.group]})
                    for (nodeid in data.nodes[group]) {
                        var nodedata = data.nodes[group][nodeid];
                        nodedata.id = nodeid;
                        nodedata.parent = group;
                        nodedata.label = nodeid.split('@')[0];
                        this.cyto.add(this._add_node_class({group: 'nodes',
                                                            data: nodedata}));
                    }
                } else {
                    for (var nodeid in data.nodes[group]) {
                        var nodedata = data.nodes[group][nodeid];
                        nodedata.id = nodeid;
                        nodedata.label = nodeid;
                        this.cyto.add(this._add_node_class({group: 'nodes',
                                                            data: nodedata}));
                    }
                }
            }

            for (var idx in data.links) {
                var edge = data.links[idx];
                this.cyto.add({group: 'edges',
                               data: {id: edge.join("::"),
                                      source: edge[0], target: edge[1]}})
            }

            this.cyto.layout({name: 'klay',
                              fit: false,
                              klay: {
                                  direction: 'DOWN',
                                  spacing: 30
                              }}).run();


            // just use the regular qtip api but on cy elements
            this.cyto.nodes('[status]').qtip({
                content: function(){ return this.data('desc'); },
                position: {my: 'top center',
                           at: 'bottom center'},
                show: {event: 'mouseover',
                       solo: true},
                hide: {event: 'mouseout click'},
                style: {classes: 'qtip-tipsy',
                        tip: {width: 16, height: 8}}
            });

            // click a node to open a tab
            this.cyto.nodes('[status]').on('click', function(e) {
                var node = e.target;
                // window.tab should be already attached
                window.tab.add(node.id()).focus(node.id());
            })

            var that = this;
            this.cyto.nodes().forEach(function(node) {
                that._update_node(node);
            });

            return this;
        }

        ready() {
            this.$wrapper.parent().removeClass('loading');
            return this;
        }

        _update_node(node) {
            // proc: procid, size: # jobs, done: # jobs done
            var nodedata = node.data();
            if ('status' in nodedata) { // it's a process
                var pbar_color = PBAR_COLORS[nodedata.status];
                var perc = 100.0 * nodedata.done / nodedata.size;
                perc = perc.toFixed(2);

                node.style({
                    'background-color': 'white',
                    'background-fill': 'linear-gradient',
                    'background-gradient-stop-colors':
                        pbar_color + ' white white',
                    'background-gradient-stop-positions': perc + '% ' +
                                                        perc +'% 100%',
                    'background-gradient-direction': 'to-right'
                });
                node.qtip('api').set('content.text',
                                    nodedata.desc + ' Complete: ' + perc + '%');
            }
        }

        pipeline_update(data) {
            // proc: procid, job: jobindex, status: succeeded|cached|failed
            // size: proc size

            var node = this.cyto.$('[id = "' + data.proc + '"]');
            delete data.proc
            node.data({...node.data(), ...data});
            this._update_node(node);
        }

    }

    window.Cyto = Cyto;

})(jQuery);
