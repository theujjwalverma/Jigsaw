export function shufflePieces(pieces, random = Math.random) {
  const shuffled = [...pieces];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  if (shuffled.length > 1 && shuffled.every((piece, index) => piece === pieces[index])) {
    shuffled.push(shuffled.shift());
  }
  return shuffled;
}
