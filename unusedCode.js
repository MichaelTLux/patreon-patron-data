//
// const data = fs.readFileSync('./Members_1969288.csv', 'utf8');
//
// const byLine = data.split('\n');
// const columnHeaders = byLine[0].split(',');
// const allPatrons = byLine.map((patron) => {
//     const values = patron.split(',');
//
//     const finalPatron = {};
//
//     columnHeaders.forEach((header, index) => {
//         finalPatron[header] = values[index]
//     });
//
//     finalPatron.original = patron;
//
//     return finalPatron;
// });
//
// const merchTierPatrons = [byLine[0]];
//
// allPatrons.forEach((patron) => {
//     if(qualifyingTiers.includes(patron.Tier)) {
//         merchTierPatrons.push(patron.original);
//     }
// });
//
// merchTierPatrons.sort((b,a) => Number(a['Lifetime Amount'])-Number(b['Lifetime Amount']));
//