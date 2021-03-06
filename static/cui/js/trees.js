
var Trees = (function() {
    var Trees = {};

    var TOKEN_TYPES = [
        { regex: /^\(/ },
        { regex: /^\)/ },
        { regex: /^,/ },
        { regex: /^None/ },
        { regex: /^[+-]?(0|[1-9]\d{0,9})/, convert: function(s) { return parseInt(s, 10); } }
    ];

    Trees.tokenize = function(input) {
        var tokens = [];

        while (input !== '') {
            input = input.replace(/^\s+/, '');

            if (input === '')
                break;

            var token = null;
            for (var i = 0; i < TOKEN_TYPES.length; i++) {
                var m = TOKEN_TYPES[i].regex.exec(input);
                if (m) {
                    input = input.substr(m[0].length);
                    token = m[0];
                    if (TOKEN_TYPES[i].convert) {
                        token = TOKEN_TYPES[i].convert(token);
                    }
                    break;
                }
            }

            if (token === null) {
                var s = input;
                if (s.length > 10)
                    s = s.substr(0, 10) + '...';
                throw new Error('unexpected input near \'' + s + '\'');
            }

            tokens.push(token);
        }

        return tokens;
    };

    Trees.Parser = function(input) {
        var self = {};
        self.tokens = Trees.tokenize(input);

        self.is_empty = function() {
            return self.tokens.length === 0;
        };

        self.read_tree = function() {
            if (self.tokens.length === 0)
                self.error_parsing('tree');

            if (self.tokens[0] === 'None') {
                self.read('None');
                return { empty: true };
            } else if (self.tokens[0] === '(') {
                self.read('(');
                var val = self.read_int();
                self.read(',');
                var l = self.read_tree();
                self.read(',');
                var r = self.read_tree();
                self.read(')');
                return { val: val, l: l, r: r };
            } else {
                self.error_parsing('tree');
            }
        };

        self.read_int = function() {
            if (self.tokens.length === 0 || typeof self.tokens[0] !== 'number')
                self.error_parsing('integer');
            return self.tokens.shift();
        };

        self.read = function(expected_token) {
            if (self.tokens.length === 0 || self.tokens[0] !== expected_token)
                self.error_parsing("'" + expected_token + "'");
            return self.tokens.shift();
        };

        self.end = function() {
            if (self.tokens.length > 0)
                self.error_parsing('end of input');
        };

        self.error_parsing = function(what) {
            throw new Error('unexpected ' + (self.tokens.length > 0 ? "'"+self.tokens[0]+"'" : 'end of input') +
                            ', required ' + what);
        };

        return self;
    };

    Trees.parse_tree = function(input) {
        var parser = Trees.Parser(input);

        if (parser.is_empty())
            return { empty: true };

        var t = parser.read_tree();
        parser.end();
        return t;
    };

    Trees.parse_tuple = function(input, format) {
        var parser = Trees.Parser(input);
        var result = {};

        var use_parens = format.length != 1;
        if (use_parens)
            parser.read('(');
        for (var i = 0; i < format.length; i++) {
            if (i > 0)
                parser.read(',');

            var val;
            if (format[i].type == 'tree')
                val = parser.read_tree();
            else if (format[i].type == 'int')
                val = parser.read_int();
            else
                throw new Error('unrecognized type: ' + format[i].type);

            result[format[i].name] = val;
        }
        if (use_parens)
            parser.read(')');
        parser.end();
        return result;
    };

    Trees.serialize_tree = function(tree) {
        if (tree.empty)
            return 'None';
        else
            return ('(' + tree.val + ', ' +
                    Trees.serialize_tree(tree.l) + ', ' +
                    Trees.serialize_tree(tree.r) + ')');
    };

    Trees.serialize_tuple = function(tuple, format) {
        var result = [];

        for (var i = 0; i < format.length; i++) {
            var data = tuple[format[i].name];

            var str;
            if (format[i].type == 'tree')
                str = Trees.serialize_tree(data);
            else if (format[i].type == 'int')
                str = data.toString();
            else
                throw new Error('unrecognized type: ' + format[i].type);

            result.push(str);
        }
        if (format.length == 1)
            return result[0];
        return '(' + result.join(", ") + ')';
    };

    return Trees;
})();

var SVG = (function() {
    var self = {};

    var svgNS = "http://www.w3.org/2000/svg";
    self.create = function(name, attributes, content) {
        var elt = document.createElementNS(svgNS, name);
        self.update(elt, attributes, content);
        return elt;
    };

    self.add = function(container, name, attributes, content) {
        var elt = self.create(name, attributes, content);
        container.appendChild(elt);
        return elt;
    };

    self.clear = function(container) {
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
    };

    self.update = function(elt, attributes, content) {
        for (var key in attributes) {
            elt.setAttributeNS(null, key, attributes[key]);
        }
        if (content !== undefined) {
            self.clear(elt);
            elt.appendChild(document.createTextNode(content));
        }
    };

    self.has_class = function(elt, class_name) {
        var class_attr = elt.getAttributeNS(null, 'class');
        return new RegExp('(\\s|^)' + class_name + '(\\s|$)').test(class_attr);
    };

    self.add_class = function(elt, class_name) {
        if (!self.has_class(elt, class_name)) {
            elt.setAttributeNS(null, 'class', elt.getAttributeNS(null, 'class') + ' ' + class_name);
        }
    };

    self.remove_class = function(elt, class_name) {
        if (self.has_class(elt, class_name)) {
            var class_attr = elt.getAttributeNS(null, 'class');
            var new_class_attr = class_attr.replace(new RegExp('(\\s|^)' + class_name + '(\\s|$)', 'g'), '$2');
            elt.setAttributeNS(null, 'class', new_class_attr);
        }
    };

    self.update_selector = function(container, selector, attributes, content) {
        var elt = container.querySelector(selector);
        self.update(elt, attributes, content);
    };

    return self;
})();


var TreeDimensions = {
    NODE_WIDTH: 30,
    EMPTY_WIDTH: 5,
    NODE_HEIGHT: 50,
    EMPTY_HEIGHT: 25,
    EMPTY_SIZE: 10
};

var TreeEditor = function($elt, $undo_button, $warning_area) {
    var self = {};

    self.init = function() {
        self.$elt = $elt;
        self.$undo_button = $undo_button;
        self.$warning_area = $warning_area;
        self.$elt.addClass('tree-editor');
        self.tree = { empty: true };

        self.svg = SVG.create("svg");
        $elt.append(self.svg);

        self.main = SVG.add(self.svg, 'g', {'class': 'tree-editor-main'});

        self.$undo_button.click(self.undo);
        self.bst_warning_enabled = false;
    };

    self.destroy = function() {
        self.remove_from_svg(self.tree);
        self.$undo_button.unbind('click');
        self.$elt.empty();
        self.$warning_area.empty();
    };

    self.set_tree = function(tree) {
        self.tree = tree;
        self.clear();
        self.update_tree();
        self.setup_undo();
    };

    self.enable_bst_warning = function() {
        self.bst_warning_enabled = true;
    };

    self.clear = function() {
        SVG.clear(self.main);
    };

    // TODO calc the dimensions properly instead of hard-coding
    self.update_tree = function() {
        self.redraw_tree();
        self.check_bst();
    };

    self.redraw_tree = function() {
        self.calc_dimensions(self.tree);

        var left_margin, right_margin;
        if (self.tree.empty) {
            left_margin = right_margin = 25;
        } else {
            // We want the root to be drawn in the center of the picture.
            left_margin = 25 + Math.max(0, self.tree.r.width - self.tree.l.width);
            right_margin = 25 + Math.max(0, self.tree.l.width - self.tree.r.width);
        }

        var width = self.tree.width + left_margin + right_margin;
        var height = self.tree.height;
        var start_x = left_margin;
        var start_y = -TreeDimensions.NODE_HEIGHT + 40;

        SVG.update(self.svg, {width: width, height: height});
        self.$elt.css({width: width+'px', height: height+'px'});

        self.calc_positions(self.tree, start_x, start_y);
        self.draw_tree(self.main, self.tree, null, 'root');
    };

    self.calc_dimensions = function(tree) {
        if (tree.empty) {
            tree.node_width = TreeDimensions.EMPTY_WIDTH;
            tree.width = TreeDimensions.EMPTY_WIDTH;
            tree.height = TreeDimensions.EMPTY_HEIGHT;
        } else {
            self.calc_dimensions(tree.l);
            self.calc_dimensions(tree.r);

            tree.node_width = self.get_node_width(tree.val);
            tree.width = tree.l.width + tree.r.width + tree.node_width;
            tree.height = TreeDimensions.NODE_HEIGHT + Math.max(tree.l.height, tree.r.height);
        }
    };

    self.calc_positions = function(tree, x, y) {
        if (tree.empty) {
            tree.x = x + TreeDimensions.EMPTY_WIDTH / 2;
            tree.y = y + TreeDimensions.EMPTY_HEIGHT;
        } else {
            tree.x = x + tree.l.width + tree.node_width / 2;
            tree.y = y + TreeDimensions.NODE_HEIGHT;

            self.calc_positions(tree.l, x, tree.y);
            self.calc_positions(tree.r, x + tree.l.width + tree.node_width, tree.y);
        }
    };

    self.get_node_width = function(value) {
        return Math.max(TreeDimensions.NODE_WIDTH, self.get_text_width(value) + 10);
    };

    self.draw_tree = function(container, tree, parent, node_type) {
        if (tree.empty) {
            if (!tree.part) {
                tree.part = EmptyTreePart(container, tree, parent, node_type);
                tree.part.node_elt.onclick = function() {
                    self.add_node(tree);
                };
            }

            tree.part.update();
        } else {
            if (!tree.part) {
                tree.part = NonEmptyTreePart(container, tree, parent, node_type);
                tree.part.edge_elt.onclick = function() {
                    self.remove_node(tree);
                };
                tree.part.node_elt.onclick = function() {
                    self.make_editable(tree);
                };
            }

            tree.part.update();

            self.draw_tree(tree.part.children_elt, tree.l, tree, 'left');
            self.draw_tree(tree.part.children_elt, tree.r, tree, 'right');
        }
    };

    self.add_node = function(tree) {
        self.add_undo_action(tree);
        self.remove_from_svg(tree);

        tree.empty = false;
        tree.val = 0;
        tree.l = { empty: true };
        tree.r = { empty: true };
        self.update_tree();
        self.make_editable(tree);
        self.scroll_into_view(tree);
    };

    self.remove_node = function(tree) {
        self.add_undo_action(tree);
        self.remove_from_svg(tree);

        tree.empty = true;
        tree.l = null;
        tree.r = null;
        self.update_tree();
    };

    // Remove all tree parts
    self.remove_from_svg = function(tree) {
        if (!tree.empty) {
            self.remove_from_svg(tree.l);
            self.remove_from_svg(tree.r);
        }
        if (tree.part) {
            tree.part.remove();
            tree.part = null;
        }
    };

    self.flatten = function(tree) {
        if (tree.empty) {
            return [];
        } else {
            var flat_left = self.flatten(tree.l);
            var flat_right = self.flatten(tree.r);
            return flat_left.concat([tree], flat_right);
        }
    };

    self.check_bst = function() {
        if (!self.bst_warning_enabled)
            return;

        var flat = self.flatten(self.tree);
        var warning = '';
        var i;
        for (i = 0; i < flat.length; ++i) {
            SVG.remove_class(flat[i].part.node_elt, 'bst-warning');
        }
        for (i = 1; i < flat.length; ++i) {
            if (flat[i-1].val >= flat[i].val) {
                warning = 'Warning: this is not a binary search tree (' +
                    flat[i-1].val + ' is not less than ' + flat[i].val + ').';
                SVG.add_class(flat[i-1].part.node_elt, 'bst-warning');
                SVG.add_class(flat[i].part.node_elt, 'bst-warning');
                break;
            }
        }

        self.$warning_area.text(warning);
    };

    self.make_editable = function(tree) {
        var $input = $('<input>').val(tree.val);
        var width = Math.max(self.get_node_width(tree.val), 76);
        $input.css({
            position: 'absolute',
            left: tree.x + 'px',
            top: tree.y + 'px',
            width: width + 'px',
            'margin-left': -width/2 + 'px'
        });
        self.$elt.append($input);
        $input.focus();
        $input.select();

        var editor = IntEditor($input);

        function exit() {
            var val = editor.get_value();
            if (val !== null && val !== tree.val) {
                self.add_undo_action(tree);

                tree.val = val;
                self.update_tree();
            }
            $input.remove();
        }

        $input.on('keypress', function(e) {
            if (e.which == 13) // enter
                exit();
        });

        // We don't want to use normal 'blur' in tests,
        // because it can be triggered by user during the test run.
        if (window.TESTING) {
            $input.on('blur-test', exit);
        } else {
            $input.on('blur', exit);
        }
    };

    self.setup_undo = function() {
        self.undo_actions = [];
        self.$undo_button.prop('disabled', true);
    };

    self.add_undo_action = function(tree) {
        self.undo_actions.push({ tree: tree,
                                 empty: tree.empty, l: tree.l, r: tree.r, val: tree.val });
        self.$undo_button.prop('disabled', false);
    };

    self.undo = function() {
        if (self.undo_actions.length === 0)
            return;

        var action = self.undo_actions.pop();

        self.remove_from_svg(action.tree);
        action.tree.empty = action.empty;
        action.tree.l = action.l;
        action.tree.r = action.r;
        action.tree.val = action.val;

        self.update_tree();

        self.$undo_button.prop('disabled', self.undo_actions.length === 0);
    };

    // HACK
    self.get_text_width = function(content) {
        var elt = SVG.add(self.main, 'text', {}, content);
        var width = elt.getBoundingClientRect().width;
        self.main.removeChild(elt);
        return width;
    };

    self.scroll_into_view = function(tree) {
        var y_bottom = tree.y + tree.height;
        var $parent = self.$elt.parent();
        var spill_over = y_bottom - $parent.height() - $parent.scrollTop();
        if (spill_over > 0)
            $parent.scrollTop($parent.scrollTop() + spill_over);
    };

    self.init();

    return self;
};

var Part = function(container, class_name) {
    var self = {};

    self.group_elt = SVG.add(container, 'g', {'class': class_name});

    self.remove = function() {
        container.removeChild(self.group_elt);
    };
    return self;
};

var EmptyTreePart = function(container, tree, parent, node_type) {
    var self = Part(container, 'empty-tree ' + node_type);

    if (parent)
        self.edge_elt = SVG.add(self.group_elt, 'line', { 'class': 'empty-edge'});

    self.node_elt = SVG.add(self.group_elt, 'rect', {
        'class': 'empty',
        width: TreeDimensions.EMPTY_SIZE, height: TreeDimensions.EMPTY_SIZE
    });

    self.update = function() {
        if (parent)
            SVG.update(self.edge_elt, {x1: parent.x, y1: parent.y, x2: tree.x, y2: tree.y});
        SVG.update(self.node_elt, {x: tree.x - TreeDimensions.EMPTY_SIZE/2,
                                   y: tree.y - TreeDimensions.EMPTY_SIZE/2});
    };
    return self;
};

var NonEmptyTreePart = function(container, tree, parent, node_type) {
    var self = Part(container, 'tree ' + node_type);


    self.edge_elt = SVG.add(self.group_elt, 'g', { 'class': 'edge' });
    self.thick_elt = SVG.add(self.edge_elt, 'line', { 'class': 'thick' });
    self.thin_elt = SVG.add(self.edge_elt, 'line', { 'class': 'thin' });

    self.children_elt = SVG.add(self.group_elt, 'g', { 'class': 'children' });

    self.node_elt = SVG.add(self.group_elt, 'g', { 'class': 'node' });
    self.rect_elt = SVG.add(self.node_elt, 'rect',
                            {height: TreeDimensions.NODE_WIDTH,
                             rx: TreeDimensions.NODE_WIDTH/2, ry: TreeDimensions.NODE_WIDTH/2 });
    self.text_elt = SVG.add(self.node_elt, 'text', {});

    self.update = function () {
        var edge_start_x, edge_start_y;
        if (parent) {
            edge_start_x = parent.x;
            edge_start_y = parent.y;
        } else {
            edge_start_x = tree.x;
            edge_start_y = tree.y - TreeDimensions.NODE_HEIGHT;
        }

        SVG.update(self.thick_elt, { x1: edge_start_x, y1: edge_start_y, x2: tree.x, y2: tree.y });
        SVG.update(self.thin_elt, { x1: edge_start_x, y1: edge_start_y, x2: tree.x, y2: tree.y });

        SVG.update(self.rect_elt,
                   {x: tree.x-tree.node_width/2, y: tree.y-TreeDimensions.NODE_WIDTH/2,
                    width: tree.node_width});
        // HACK: vertical alignment is hardcoded, because
        // IE doesn't support 'dominant-baseline: central'.
        SVG.update(self.text_elt, {
            x: tree.x, y: tree.y + 5,
        }, tree.val);
    };

    return self;
};

var IntEditor = function($input) {
    var self = {};

    self.validate = function() {
        if (self.get_value() === null)
            $input.addClass('error');
        else
            $input.removeClass('error');
    };

    self.get_value = function() {
        var s = $input.val();
        if (!/^[+-]?(0|[1-9]\d{0,9})$/.test(s))
            return null;
        var n = parseInt(s, 10);
        if (!(-2147483648 <= n && n <= 2147483647))
            return null;
        return n;
    };

    $input.attr('maxlength', 11).on('change keyup paste', self.validate);
    return self;
};
