export function findElement(tree, matcher) {
  if (!tree?.props) return undefined;
  if (typeof matcher === "function" ? matcher(tree) : tree.type === matcher) return tree;
  for (const child of [tree.props.children].flat(Infinity)) {
    const result = findElement(child, matcher);
    if (result) return result;
  }
}
