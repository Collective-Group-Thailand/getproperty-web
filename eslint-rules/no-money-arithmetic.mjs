/**
 * `getproperty/no-money-arithmetic` — the UI formats money and meter quantities, it never computes
 * them (CLAUDE.md: "Money is a decimal string from the API; format with `formatTHB`, never do
 * arithmetic on it. Meter quantities are decimal strings; format with `formatUnits`").
 *
 * Money and metered figures arrive as the API's decimal strings (`amount`, `balance`, `unitPrice`,
 * `units`, `reading` …). This flags, in the files it is applied to:
 *
 *   - arithmetic (`+ - * / %`, and `+=`-style assignments) with such a value on either side;
 *   - turning one into a number (`Number(x.amount)`, `parseFloat(…)`, `+x.balance`), which is only
 *     ever the first step of doing sums with it.
 *
 * A value is "such a value" when the last name in its access path is one of the API's money or
 * quantity fields. Formatting (`formatTHB(x.amount)`), comparing strings and passing values along are
 * untouched. Tests and mocks are outside the rule's files: a mock *is* a fake engine.
 */

const MONEY =
  /^(amount|totalAmount|subtotalAmount|vatAmount|netAmount|grossAmount|paidAmount|dueAmount|outstandingAmount|balance|arrears|deposit|depositAmount|refundAmount|deductionAmount|unitPrice|pricePerUnit|rate|tariffRate|serviceCharge|ft|ftRate|cap|capRate|lateFee|discount|discountAmount|units|unitsConsumed|consumption|reading|previousReading|currentReading|register|lossUnits|lossAmount|lossPct|pct|percent)$/;

/** The last property or identifier name of an expression like `a.b.amount` or `bill["balance"]`. */
function lastName(node) {
  if (!node) return null;
  if (node.type === "ChainExpression") return lastName(node.expression);
  if (node.type === "TSNonNullExpression") return lastName(node.expression);
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression") {
    if (!node.computed && node.property.type === "Identifier") return node.property.name;
    if (node.computed && node.property.type === "Literal" && typeof node.property.value === "string")
      return node.property.value;
  }
  return null;
}

const NUMBERING = new Set(["Number", "parseFloat", "parseInt"]);

/** The value an expression does arithmetic with, looking through `Number(…)` and unary `+`. */
function operand(node) {
  if (node?.type === "CallExpression" && node.callee.type === "Identifier" && NUMBERING.has(node.callee.name))
    return operand(node.arguments[0]);
  if (node?.type === "UnaryExpression" && (node.operator === "+" || node.operator === "-"))
    return operand(node.argument);
  return node;
}

const isMoney = (node) => {
  const name = lastName(operand(node));
  return name !== null && MONEY.test(name);
};

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "No arithmetic on money or meter quantities in the browser — format what the API returns.",
    },
    messages: {
      arithmetic:
        "'{{name}}' is the API's figure: format it (formatTHB / formatUnits), never compute with it (CLAUDE.md). Ask the API for the number you need.",
      numbering:
        "Turning '{{name}}' into a number is the first step of computing with it; format the API's value instead (CLAUDE.md).",
    },
    schema: [],
  },
  create(context) {
    const ARITHMETIC = new Set(["+", "-", "*", "/", "%", "**"]);
    const report = (node, messageId, name) => context.report({ node, messageId, data: { name } });
    return {
      BinaryExpression(node) {
        if (!ARITHMETIC.has(node.operator)) return;
        // `"฿" + x.amount` — string concatenation is not arithmetic.
        if (
          node.operator === "+" &&
          [node.left, node.right].some((side) => side.type === "Literal" && typeof side.value === "string")
        )
          return;
        for (const side of [node.left, node.right])
          if (isMoney(side)) return report(node, "arithmetic", lastName(operand(side)));
      },
      AssignmentExpression(node) {
        if (["+=", "-=", "*=", "/=", "%="].includes(node.operator) && (isMoney(node.left) || isMoney(node.right)))
          report(node, "arithmetic", lastName(operand(isMoney(node.left) ? node.left : node.right)));
      },
      CallExpression(node) {
        if (node.callee.type === "Identifier" && NUMBERING.has(node.callee.name) && isMoney(node.arguments[0]))
          report(node, "numbering", lastName(operand(node.arguments[0])));
      },
      UnaryExpression(node) {
        if (node.operator === "+" && isMoney(node.argument))
          report(node, "numbering", lastName(operand(node.argument)));
      },
    };
  },
};

export default rule;
