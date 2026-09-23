import { chromium } from '/home/user/AX-MVP-Factory-OS/node_modules/playwright/index.mjs'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage()
const row = (cells) => '<tr>' + cells.map((c, i) => `<td style="text-align:${i ? 'right' : 'left'};padding:2px 8px">${c}</td>`).join('') + '</tr>'
const tbl = (title, unit, hdr, rows) => `<h3>${title}</h3><div style="text-align:right">단위:${unit}</div><table style="border-collapse:collapse;width:100%;font-size:11px">${row(hdr)}${rows.map(row).join('')}</table>`
const html = `<html><body style="font-family:'Noto Sans KR',sans-serif">
<div>기업명 테스트산업(주)</div>
${tbl('재무상태표', '천원', ['구분', '2022-12-31', '2023-12-31', '2024-12-31'], [['감사의견', '적정', '적정', '적정'], ['유동자산', '4,351,000', '4,355,000', '4,453,000'], ['유동부채', '270,000', '440,000', '343,000'], ['부채', '2,136,112', '2,151,348', '2,178,842'], ['자본', '3,372,527', '3,470,689', '3,537,221']])}
${tbl('손익계산서', '천원', ['구분', '2022-12-31', '2023-12-31', '2024-12-31'], [['매출액', '6,472,000', '6,775,000', '6,703,634'], ['영업이익', '-18,752', '58,000', '41,000'], ['당기순이익', '135,583', '123,162', '92,443']])}
<div style="page-break-before:always"></div>
${tbl('제조원가명세서', '천원', ['구분', '2022-12-31', '2023-12-31', '2024-12-31'], [['재료비', '1,200,000', '1,300,000', '1,250,000'], ['노무비', '800,000', '820,000', '840,000'], ['당기제품제조원가', '2,500,000', '2,600,000', '2,550,000']])}
${tbl('이익잉여금처분계산서', '천원', ['구분', '2022-12-31', '2023-12-31', '2024-12-31'], [['미처분이익잉여금', '900,000', '1,000,000', '1,090,000'], ['이익잉여금처분액', '0', '0', '0']])}
</body></html>`
await p.setContent(html); await p.pdf({ path: process.argv[2], format: 'A4' }); await b.close()
