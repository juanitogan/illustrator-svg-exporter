/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 Waybury
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

#target illustrator

var exportFolder,
    sourceDoc,
    itemsToExport,
    exportDoc,
    svgOptions;

try {
  if ( app.documents.length > 0 ) {
    svgOptions = new ExportOptionsSVG();
    svgOptions.embedRasterImages = false;
    svgOptions.cssProperties = SVGCSSPropertyLocation.PRESENTATIONATTRIBUTES;
    svgOptions.fontSubsetting = SVGFontSubsetting.None;
    svgOptions.documentEncoding = SVGDocumentEncoding.UTF8;
    svgOptions.coordinatePrecision = 4;

    itemsToExport = [];
    sourceDoc = app.activeDocument;
    exportFolder = Folder.selectDialog('Select Folder to Save Files');
    exportDoc = documents.add(DocumentColorSpace.RGB);

    main();

    exportDoc.close(SaveOptions.DONOTSAVECHANGES);
  }
  else{
    throw new Error('There are no documents open. Open a document and try again.');
  }
}
catch(e) {
  alert(e.message, "Script Alert", true);
}

function main() {
  var item;
  app.activeDocument = sourceDoc;
  itemsToExport = getNamedItems(sourceDoc);

  for ( var i = 0, len = itemsToExport.length; i < len; i++ ) {


    item = itemsToExport[i];

    if ( item.typename === 'Artboard' ) {
      exportArtboard(item);
    } else if ( item.typename === 'Layer' ) {
      exportLayer(item);
    } else {
      exportItem(item);
    }

    // Empty export document
    exportDoc.pageItems.removeAll();
  }

}

function resizeItem(item) {
  resizeToPct = 10; // resize down to 10%
  item.resize(
    resizeToPct, // x
    resizeToPct, // y
    true, // changePositions
    true, // changeFillPatterns
    true, // changeFillGradients
    true, // changeStrokePattern
    resizeToPct, // changeLineWidths    <----  NOTE THIS resizeToPct
    undefined //Transformation.DOCUMENTORIGIN // scaleAbout
  );
  //return item;
}

function exportArtboard(artboard) {

  var item,
      name,
      prettyName,
      doc,
      rect,
      bbox,
      newItem;

  app.activeDocument = sourceDoc;
  rect = artboard.artboardRect;

  bbox = sourceDoc.pathItems.rectangle(rect[1], rect[0], rect[2]-rect[0], rect[1]-rect[3]);
  bbox.stroked = false;
  bbox.name = '__ILSVGEX__BOUNDING_BOX';

  name = artboard.name;
  prettyName = name.slice(0, -4).replace(/[^\w\s]|_/g, " ").replace(/\s+/g, "-").toLowerCase();

  app.activeDocument = exportDoc;

  for ( var i = 0, len = sourceDoc.pageItems.length; i < len; i++ ) {
    item = sourceDoc.pageItems[i];

    if( hitTest(item, bbox) && !item.locked && !anyParentLocked(item)  ) {
      newItem = item.duplicate( exportDoc, ElementPlacement.PLACEATEND );
      resizeItem(newItem);
    }
  }

  app.activeDocument = exportDoc;
  exportDoc.pageItems.getByName('__ILSVGEX__BOUNDING_BOX').remove();

  // Check if artboard is blank, clean up and exit
  if(!exportDoc.pageItems.length) {
    sourceDoc.pageItems.getByName('__ILSVGEX__BOUNDING_BOX').remove();
    return;
  }

  for ( i = 0, len = exportDoc.pageItems.length; i < len; i++) {
    item = exportDoc.pageItems[i];

    /*
     * For the moment, all pageItems are made visible and exported
     * unless they are locked. This may not make sense, but it'll
     * work for now.
     */
    item.hidden = false;
  }

  // Not terribly useful to preserve original artboard after resizing.  Rethink sometime.
  // This maybe... since we are resizing around origin:
  var artboardBounds = bbox.visibleBounds;
  //var artboardBounds = rect;
  //for ( var i = 0; i < 4; i++ ) {
  //  artboardBounds[i] *= 10 / 100; //resizeToPct / 100
  //}

  exportDoc.layers[0].name = prettyName;
  exportSVG( exportDoc, name, artboardBounds, svgOptions );

  sourceDoc.pageItems.getByName('__ILSVGEX__BOUNDING_BOX').remove();
}

function exportLayer(layer) {

  var item,
      startX,
      startY,
      endX,
      endY,
      name,
      prettyName,
      itemName,
      layerItems,
      newItem;

  layerItems = [];

  for ( var i = 0, len = layer.pageItems.length; i < len; i++ ) {
    layerItems.push(layer.pageItems[i]);
  }
  recurseItems(layer.layers, layerItems);

  if ( !layerItems.length ) {
    return;
  }

  name = layer.name;
  prettyName = name.slice(0, -4).replace(/[^\w\s]|_/g, " ").replace(/\s+/g, "-").toLowerCase();

  for ( i = 0, len = layerItems.length; i < len; i++ ) {
    app.activeDocument = sourceDoc;
    item = layerItems[i];
    newItem = item.duplicate( exportDoc, ElementPlacement.PLACEATEND );
    resizeItem(newItem);
  }

  app.activeDocument = exportDoc;

  for ( i = 0, len = exportDoc.pageItems.length; i < len; i++) {

    item = exportDoc.pageItems[i];

    /*
     * For the moment, all pageItems are made visible and exported
     * unless they are locked. This may not make sense, but it'll
     * work for now.
     */
    item.hidden = false;

    if(item.name) {
      itemName = item.name;
      if(itemName.split('.').pop() === 'svg') {
        itemName = itemName.slice(0, -4);
      }
      itemName = itemName.replace(/[^\w\s]|_/g, " ").replace(/\s+/g, "-").toLowerCase()

      item.name = prettyName + '-' + itemName;
    }
    /*
     * We want the smallest startX, startY for obvious reasons.
     * We also want the smallest endX and endY because Illustrator
     * Extendscript treats this coordinate reversed to how the UI
     * treats it (e.g., -142 in the UI is 142).
     *
     */
    startX = ( !startX || startX > item.visibleBounds[0] ) ? item.visibleBounds[0] : startX;
    startY = ( !startY || startY < item.visibleBounds[1] ) ? item.visibleBounds[1] : startY;
    endX = ( !endX || endX < item.visibleBounds[2] ) ? item.visibleBounds[2] : endX;
    endY = ( !endY || endY > item.visibleBounds[3] ) ? item.visibleBounds[3] : endY;
  }

  exportDoc.layers[0].name = name.slice(0, -4);
  exportSVG( exportDoc, name, [startX, startY, endX, endY], svgOptions );
}

function exportItem(item) {

  var name,
      newItem;

  name = item.name;
  newItem = item.duplicate( exportDoc, ElementPlacement.PLACEATEND );
  newItem.hidden = false;
  resizeItem(newItem);
  newItem.name = item.name.slice(0, -4);
  app.activeDocument = exportDoc;

  exportDoc.layers[0].name = ' ';
  exportSVG( exportDoc, name, newItem.visibleBounds, svgOptions );
}

function exportSVG(doc, name, bounds, exportOptions) {
  /*
  var logDoc = documents.add();
  var logText = logDoc.textFrames.add();
  logText.top = 600;
  logText.left = 200;
  logText.contents += String(bounds[0]) + '\r';
  logText.contents += String(bounds[1]) + '\r';
  logText.contents += String(bounds[2]) + '\r';
  logText.contents += String(bounds[3]) + '\r';
  */
  // Prevent artboard dimensions from going below 1.0pt. Else error: 1346458189
  var x = bounds[2] - bounds[0];
  var y = bounds[1] - bounds[3];
  // Center while accounting for precision errors.
  if (x < 1) {
    var xOffset  = (1 - x) / 2;
    bounds[0] -= xOffset;
    bounds[2] = bounds[0] + 1;
  }
  if (y < 1) {
    var yOffset  = (1 - y) / 2;
    bounds[1] += yOffset;
    bounds[3] = bounds[1] - 1;
  }

  doc.artboards[0].artboardRect = bounds;

  var file = new File( exportFolder.fsName + '/' + name );
  doc.exportFile( file, ExportType.SVG, exportOptions );
}

function getNamedItems(doc) {
  var item,
      items,
      doclayers,
      artboards;

  items = [];

  // Check all artboards for name match
  artboards = [];

  for ( var i = 0, len = doc.artboards.length; i < len; i++ ) {
    item = doc.artboards[i];
    if ( item.name.split('.').pop() === 'svg' ) {
      items.push(item);
    }
  }

  // Check all layers for name match
  doclayers = [];
  recurseLayers( doc.layers, doclayers );

  for ( i = 0, len = doclayers.length; i < len; i++ ) {
    item = doclayers[i];

    if ( item.name.split('.').pop() === 'svg' && !item.locked && !anyParentLocked(item) ) {
      items.push(item);
    }
  }

  // Check all pageItems for name match
  for ( i = 0, len = doc.pageItems.length; i < len; i++ ) {
    item =  doc.pageItems[i];

    if ( item.name.split('.').pop() === 'svg' && !item.locked && !anyParentLocked(item) ) {
      items.push(item);
    }
  }

  return items;
}

function recurseLayers(layers, layerArray) {

  var layer;

  for ( var i = 0, len = layers.length; i < len; i++ ) {
    layer = layers[i];
    if ( !layer.locked ) {
      layerArray.push(layer);
    }
    if (layer.layers.length > 0) {
      recurseLayers( layer.layers, layerArray );
    }
  }
}

function recurseItems(layers, items) {

  var layer;

  for ( var i = 0, len = layers.length; i < len; i++ ) {
    layer = layers[i];
    if ( layer.pageItems.length > 0 && !layer.locked ) {
      for ( var j = 0, plen = layer.pageItems.length; j < plen; j++ ) {
        if ( !layer.pageItems[j].locked ) {
          items.push(layer.pageItems[j]);
        }
      }
    }

    if ( layer.layers.length > 0 ) {
      recurseItems( layer.layers, items );
    }
  }
}

function anyParentLocked(item) {
  while ( item.parent ) {
    if ( item.parent.locked ) {
      return true;
    }
    item = item.parent;
  }

  return false;
}


/* Code derived from John Wundes ( john@wundes.com ) www.wundes.com
 * Copyright (c) 2005 wundes.com
 * All rights reserved.
 *
 * This code is derived from software contributed to or originating on wundes.com
 */

function hitTest(a,b){
  if(!hitTestX(a,b)){
    return false;
  }
  if(!hitTestY(a,b)){
    return false;
  }
  return true;
}

function hitTestX(a,b){
  var p1 = a.visibleBounds[0];
  var p2 = b.visibleBounds[0];
  if( (p2<=p1 && p1<=p2+b.width) || (p1<=p2 && p2<=p1+a.width) ) {
     return true;
  }
  return false;
}

function hitTestY(a,b){
  var p3 = a.visibleBounds[1];
  var p4 = b.visibleBounds[1];
  if( (p3>=p4 && p4>=(p3-a.height)) || (p4>=p3 && p3>=(p4-b.height)) ) {
    return true;
  }
  return false;
}
