// ==UserScript==
// @name         sketchfab
// @version      0.1
// @description  download sketchfab models
// @author       tianye
// @include      /^https?://(www\.)?sketchfab\.com/.*
// @run-at       document-start
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';
    var window = unsafeWindow;
    console.log("[UserScript]init", window);

    var savestring = function(filename, str) {
        var textblob = new Blob([str], {type:'text/plain'});

        var link = document.createElement('a');
        link.download = filename;
        link.innerHTML = 'Download File';
        link.href = window.URL.createObjectURL(textblob);
        link.onclick = function(e) {
            document.body.removeChild(e.target);
        };
        link.style.display = 'none';
        document.body.appendChild(link);

        link.click();
        console.log("[UserScript]savestring", filename);
    }

    var saveimagecache = {};
    var saveimage = function(filename, url) {
        if (!saveimagecache[url]) {
            saveimagecache[url] = true;

            var link = document.createElement('a');
            link.download = filename;
            link.innerHTML = 'Download File';
            link.href = url;
            link.target = '_blank';
            link.onclick = function(e) {
                document.body.removeChild(e.target);
            };
            document.body.appendChild(link);

            link.click();
        }
        console.log("[UserScript]saveimage", filename);
    }

    var dosavefile = function(mdl) {
        var obj = mdl.obj;
        var str = '';
        str += 'mtllib ' + mdl.name + '.mtl\n';
        str += 'o ' + mdl.name + '\n';
        for (var i = 0; i < obj.vertex.length; i += 3) {
            str += 'v ';
            for (var j = 0; j < 3; ++j) {
                str += obj.vertex[i + j] + ' ';
            }
            str += '\n';
        }
        for (i = 0; i < obj.normal.length; i += 3) {
            str += 'vn ';
            for (j = 0; j < 3; ++j) {
                str += obj.normal[i + j] + ' ';
            }
            str += '\n';
        }
        for (i = 0; i < obj.uv.length; i += 2) {
            str += 'vt ';
            for (j = 0; j < 2; ++j) {
                str += obj.uv[i + j] + ' ';
            }
            str += '\n';
        }
        str += 'usemtl ' + mdl.name + '\n';
        str += 's on \n';

        var vn = obj.normal.length != 0;
        var vt = obj.uv.length != 0;

        for (i = 0; i < obj.primitives.length; ++i) {
            var primitive = obj.primitives[i];
            if (primitive.mode == 4 || primitive.mode == 5) {
                var strip = (primitive.mode == 5);
                for (j = 0; j + 2 < primitive.indices.length; !strip ? j += 3 : j++) {
                    str += 'f ';
                    var order = [ 0, 1, 2];
                    if (strip && (j % 2 == 1)) {
                        order = [ 0, 2, 1];
                    }
                    for (var k = 0; k < 3; ++k) {
                        var faceNum = primitive.indices[j + order[k]] + 1;
                        str += faceNum;
                        if (vn || vt) {
                            str += '/';
                            if (vt) {
                                str += faceNum;
                            }
                            if (vn) {
                                str += '/' + faceNum;
                            }
                        }
                        str += ' ';
                    }
                    str += '\n';
                }
            }
            else {
                console.log("[UserScript]dosavefile: unknown primitive mode", primitive);
            }
        }
        savestring(mdl.name+".obj", str);

        var tex = mdl.tex;
        var mtl = '';
        mtl += 'newmtl ' + mdl.name + '\n';
        tex.forEach(function(texture) {
            mtl += texture.type + ' ' + texture.filename + '\n';
            saveimage(texture.filename, texture.url);
        });
        savestring(mdl.name+".mtl", mtl);
    }

    var parseobj = function(obj) {
        var list = [];
        obj._primitives.forEach(function(p) {
            if(p && p.indices) {
                list.push({
                    'mode' : p.mode,
                    'indices' : p.indices._elements
                });
            }
        })

        var attr = obj._attributes;
        return {
            vertex: attr.Vertex._elements,
            normal: attr.Normal ? attr.Normal._elements : [],
            uv: attr.TexCoord0 ? attr.TexCoord0._elements : [],
            primitives: list,
        };
    }

    var textype = {
        DiffusePBR: "map_Kd",
        DiffuseColor: "map_Kd",
        SpecularPBR: "map_Ks",
        SpecularColor: "map_Ks",
        GlossinessPBR: "map_Pm",
        NormalMap : "map_bump",
        EmitColor : "map_Ke",
        AlphaMask : "map_d",
        Opacity : "map_o"
    };

    var parsetex = function(obj) {
        var texlist = [];
        var stateset = obj._parents[0].stateset;
        if (stateset && stateset._textureAttributeArrayList) {
            stateset._textureAttributeArrayList.forEach(function(arr) {
                if (arr && arr[0]&& arr[0]._object) {
                    var object = arr[0]._object;
                    var image = object._texture && object._texture._image
                    if (image && image._url) {
                        var type = textype[object._channels[0]] || object._channelName || "map_Kd";

                        texlist.push({
                            url: image._url,
                            type: type,
                            filename:new String(image._url).substring(image._url.lastIndexOf('/') + 1)
                        });
                    } else {
                        var packed = object._packedTextures;
                        if (packed) {
                            object._channels.forEach(function(channel) {
                                var type = textype[channel] || "map_Kd";
                                var image = packed[channel] && packed[channel].texture && packed[channel].texture._image;
                                if (image && image._url) {
                                    texlist.push({
                                        url: image._url,
                                        type: type,
                                        filename:new String(image._url).substring(image._url.lastIndexOf('/') + 1)
                                    });
                                }
                            });
                        }
                    }
                }
            });
        }
        return texlist;
    }

    var dodownload = function() {
        console.log("[UserScript]download");
        window.allmodel.forEach(function(obj) {
            var mdl = {
                name: obj._name,
                obj:parseobj(obj),
                tex:parsetex(obj),
            }
            console.log(mdl);
            dosavefile(mdl);
        })
    }

    var addbtnfunc = function() {
        var p = document.evaluate("//div[@class='titlebar']", document, null, 9, null).singleNodeValue;
        if(p) {
            console.log("[UserScript]add btn");
            var btn = document.createElement("a");
            btn.setAttribute("class", "control");
            btn.innerHTML = "<pre style='color:red;'>DOWNLOAD</pre>";
            btn.addEventListener("click", dodownload , false);
            p.appendChild(btn);
        } else {
            console.log("[UserScript]try add btn later");
            //setTimeout(addbtnfunc, 1000);
        }
    }
    setTimeout(addbtnfunc, 3000);

    window.allmodel = [];
    window.drawhook = function(obj) {
        if(obj._faked != true) {
            obj._faked = true;
            window.allmodel.push(obj)
            console.log(obj);
        }
    }
    window.addEventListener('beforescriptexecute', function(e) {
        var src = e.target.src;
        if((""+src).length == 0) {
            return;
        }
        //console.log("[UserScript]load script: " + src);

        //try patch all web/dist/**.js
        //because of a hash path is used for viewer.js
        if (src.indexOf("web/dist/") >= 0 || src.indexOf("standaloneViewer") >= 0) {
            e.preventDefault();
            e.stopPropagation();

            var req = new XMLHttpRequest();
            req.open('GET', src, false);
            req.send('');

            var jstext = req.responseText;
            if (jstext.indexOf("drawImplementation:function(e){var t=e.getLastProgramApplied()") >= 0) {
                console.log("inject1:" + src);
                jstext = jstext.split("drawImplementation:function(e){var t=e.getLastProgramApplied()").join("drawImplementation:function(e){window.drawhook(this);var t=e.getLastProgramApplied()");
            } else if (jstext.indexOf("drawImplementation: function(state) {") >= 0) {
                console.log("inject2:" + src);
                jstext = jstext.split("drawImplementation: function(state) {").join("drawImplementation: function(state) { window.drawhook(this);");
            } else if (jstext.indexOf("drawGeometry:function(t){var e=t.getLastProgramApplied()") >= 0) {
                console.log("inject3:" + src);
                jstext = jstext.split("drawGeometry:function(t){var e=t.getLastProgramApplied()").join("drawGeometry:function(t){window.drawhook(this._geometry);var e=t.getLastProgramApplied()");
            } else if (jstext.indexOf("drawGeometry:function(t){") >= 0) {
                console.log("inject4:" + src);
                jstext = jstext.split("drawGeometry:function(t){").join("drawGeometry:function(t){window.drawhook(this._geometry);");
            }

            var obj = document.createElement('script');
            obj.type = "text/javascript";
            obj.text = jstext;
            document.getElementsByTagName('head')[0].appendChild(obj);

            //console.log("[UserScript]Injection: viewer.js patched");
        };
    }, true);
})();
