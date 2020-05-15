"""Some utility functions for pyppl_web"""
from socket import socket
from pyppl import Proc, PyPPL
from pyppl.jobmgr import STATES

def auto_port() -> int:
    """Find an available port"""
    with socket() as sock:
        sock.bind(('', 0))
        return sock.getsockname()[1]

class PipelineData:
    """Since we don't have hidden nodes, so we define a new class
    other than the one used in pyppl_flowchart"""
    ROOTGROUP: str = "__ROOT__"

    def __init__(self, ppl: PyPPL):
        # {group => nodeid => node data}
        self.ppl = ppl
        self.nodes: dict = {}
        self.links: list = []
        self.name: str = ppl.name

    def assemble(self):
        """Assemble from the pipeline"""
        # nodes
        for node in self.ppl.starts:
            self.add_node(node, is_start=True)
        for node in self.ppl.ends:
            self.add_node(node, is_end=True)
        for node in self.ppl.procs:
            if node.config.get('flowchart_hide'):
                self.add_node(node, is_hidden=True)
            # edges
            if not node.nexts:
                continue
            for nextnode in node.nexts:
                self.add_link(node, nextnode)

        return self

    def add_node(self, node: Proc,
                 is_start: bool = False, is_end: bool = False,
                 is_hidden: bool = False):
        """Add a node to the pipeline data"""
        nodedata = {'desc': node.desc,
                    # can't do this before the proc starts running
                    # let's update it in update_node
                    #'size': node.size,
                    'size': 1,
                    'done': 0,
                    'status': ''}
        if is_start:
            nodedata['is_start'] = True
        if is_end:
            nodedata['is_end'] = True
        if is_hidden:
            nodedata['is_hidden'] = True

        group: str = node.procset or PipelineData.ROOTGROUP
        self.nodes.setdefault(group, {})
        self.nodes[group].setdefault(node.shortname, {})
        self.nodes[group][node.shortname].update(nodedata)

    def update_node(self, node: Proc, status: str = ''):
        """Update node data"""
        group: str = node.procset or PipelineData.ROOTGROUP
        nodedata = self.nodes[group][node.shortname]
        nodedata['size'] = node.size
        # state not attached in prerun hook
        nodedata['done'] = sum(1 for pjob in node.jobs
                               if getattr(pjob, 'state', None) in (
                                   STATES.DONE,
                                   STATES.DONECACHED,
                                   STATES.ENDFAILED
                               ))
        # if a process has failed, it's anyway failed
        if nodedata['status'] != 'failed':
            nodedata['status'] = status

    def node_data(self, node: Proc) -> dict:
        """Get the data for a node for individual socket response"""
        group: str = node.procset or PipelineData.ROOTGROUP
        return dict(proc=node.shortname,
                    **self.nodes[group][node.shortname])

    def add_link(self, node1: Proc, node2: Proc):
        """Add a link to the pipeline data"""
        pair = (node1.shortname, node2.shortname)
        if pair not in self.links:
            self.links.append(pair)

    def dict(self) -> dict:
        """Convert to json data to send to client"""
        return {
            "name": self.name,
            "nodes": self.nodes,
            "links": self.links
        }
