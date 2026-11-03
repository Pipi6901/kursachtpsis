// Выгрузка плакатов в формат draw.io (.drawio): страница А3 альбомная, заголовок, надписи и подписи – редактируемый текст,
// схемы и снимки – вставленные картинки (схемы векторные, SVG). Размеры задаются в мм и переводятся в пиксели страницы draw.io.
const fs = require('fs');

const PX = 1654 / 420;                      // пикселей draw.io на мм: страница А3 = 1654 × 1169
const PT = 1.389;                           // пикселей на пункт при таком масштабе
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function cell(id, e) {
  const g = `<mxGeometry x="${(e.x * PX).toFixed(1)}" y="${(e.y * PX).toFixed(1)}" width="${(e.w * PX).toFixed(1)}" height="${(e.h * PX).toFixed(1)}" as="geometry"/>`;
  if (e.kind === 'image') {
    const style = `shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=1;aspect=fixed;image=data:${e.mime},${e.b64};`;
    return `<mxCell id="c${id}" value="" style="${style}" vertex="1" parent="1">${g}</mxCell>`;
  }
  const style = `text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontFamily=Helvetica;fontSize=${Math.round(e.pt * PT)};`;
  return `<mxCell id="c${id}" value="${esc(e.lines.join('<br>'))}" style="${style}" vertex="1" parent="1">${g}</mxCell>`;
}

function page(name, idx, elements) {
  const cells = elements.map((e, i) => cell(i + 2, e)).join('');
  return `<diagram name="${esc(name)}" id="plakat${idx}"><mxGraphModel dx="1654" dy="1169" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1654" pageHeight="1169" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel></diagram>`;
}

function write(file, pages) {          // pages: [{name, elements}]
  const xml = `<mxfile host="app.diagrams.net">${pages.map((p, i) => page(p.name, i + 1, p.elements)).join('')}</mxfile>`;
  fs.writeFileSync(file, xml);
}

const svgImage = (svg, w, h, x, y, wmm, hmm) => ({
  kind: 'image', x, y, w: wmm, h: hmm, mime: 'image/svg+xml',
  b64: Buffer.from(svg.replace(/<svg ([^>]*?)width="[^"]*" height="[^"]*"/, `<svg $1width="${w}" height="${h}"`)).toString('base64'),
});

module.exports = { write, svgImage };
