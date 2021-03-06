import { GLOBAL_SYMBOL_TABLE } from '../ast/Globals';
import {
  ContractNode,
  ParameterNode,
  VariableDefinitionNode,
  FunctionDefinitionNode,
  IdentifierNode,
  StatementNode,
  BlockNode,
} from '../ast/AST';
import AstTraversal from '../ast/AstTraversal';
import { SymbolTable, Symbol } from '../ast/SymbolTable';
import {
  FunctionRedefinitionError,
  VariableRedefinitionError,
  UndefinedReferenceError,
  UnusedVariableError,
} from '../Errors';

export default class SymbolTableTraversal extends AstTraversal {
  private symbolTables: SymbolTable[] = [GLOBAL_SYMBOL_TABLE];
  private functionNames: Map<string, boolean> = new Map<string, boolean>();

  visitContract(node: ContractNode) {
    node.symbolTable = new SymbolTable(this.symbolTables[0]);
    this.symbolTables.unshift(node.symbolTable);

    node.parameters = this.visitList(node.parameters) as ParameterNode[];
    node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];

    const unusedSymbols = node.symbolTable.unusedSymbols();
    if (unusedSymbols.length !== 0) {
      throw new UnusedVariableError(unusedSymbols[0]);
    }

    this.symbolTables.shift();
    return node;
  }

  visitParameter(node: ParameterNode) {
    if (this.symbolTables[0].get(node.name)) {
      throw new VariableRedefinitionError(node);
    }

    this.symbolTables[0].set(Symbol.parameter(node));
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode) {
    // Checked for function redefinition, but they are not included in the
    // symbol table, as internal function calls are not supported.
    if (this.functionNames.get(node.name)) {
      throw new FunctionRedefinitionError(node);
    }
    this.functionNames.set(node.name, true);

    node.symbolTable = new SymbolTable(this.symbolTables[0]);
    this.symbolTables.unshift(node.symbolTable);

    node.parameters = this.visitList(node.parameters) as ParameterNode[];
    node.body = this.visit(node.body);

    const unusedSymbols = node.symbolTable.unusedSymbols();
    if (unusedSymbols.length !== 0) {
      throw new UnusedVariableError(unusedSymbols[0]);
    }

    this.symbolTables.shift();
    return node;
  }

  visitBlock(node: BlockNode) {
    node.symbolTable = new SymbolTable(this.symbolTables[0]);
    this.symbolTables.unshift(node.symbolTable);

    node.statements = this.visitOptionalList(node.statements) as StatementNode[];

    const unusedSymbols = node.symbolTable.unusedSymbols();
    if (unusedSymbols.length !== 0) {
      throw new UnusedVariableError(unusedSymbols[0]);
    }

    this.symbolTables.shift();
    return node;
  }

  visitVariableDefinition(node: VariableDefinitionNode) {
    if (this.symbolTables[0].get(node.name)) {
      throw new VariableRedefinitionError(node);
    }

    node.expression = this.visit(node.expression);
    this.symbolTables[0].set(Symbol.variable(node));

    return node;
  }

  visitIdentifier(node: IdentifierNode) {
    const definition = this.symbolTables[0].get(node.name);

    if (!definition) {
      throw new UndefinedReferenceError(node);
    }

    node.definition = definition;
    node.definition.references.push(node);

    return node;
  }
}
