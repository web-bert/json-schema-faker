"use strict";
var clean = require("./clean");
var random = require("./random");
var ParseError = require("./error");
var inferType = require("./infer");
var types = require("../types/index");
var option = require("../api/option");
function isExternal(schema) {
    return schema.faker || schema.chance || schema.casual;
}
function reduceExternal(schema, path) {
    if (schema['x-faker']) {
        schema.faker = schema['x-faker'];
    }
    if (schema['x-chance']) {
        schema.chance = schema['x-chance'];
    }
    if (schema['x-casual']) {
        schema.casual = schema['x-casual'];
    }
    var count = (schema.faker !== undefined ? 1 : 0) +
        (schema.chance !== undefined ? 1 : 0) +
        (schema.casual !== undefined ? 1 : 0);
    if (count > 1) {
        throw new ParseError('ambiguous generator mixing faker, chance or casual: ' + JSON.stringify(schema), path);
    }
    return schema;
}
// TODO provide types
function traverse(schema, path, resolve) {
    resolve(schema);
    if (Array.isArray(schema["enum"])) {
        return random.pick(schema["enum"]);
    }
    if (option('useDefaultValue') && 'default' in schema) {
        return schema["default"];
    }
    // TODO remove the ugly overcome
    var type = schema.type;
    if (Array.isArray(type)) {
        type = random.pick(type);
    }
    else if (typeof type === 'undefined') {
        // Attempt to infer the type
        type = inferType(schema, path) || type;
    }
    schema = reduceExternal(schema, path);
    if (isExternal(schema)) {
        type = 'external';
    }
    if (typeof type === 'string') {
        if (!types[type]) {
            if (option('failOnInvalidTypes')) {
                throw new ParseError('unknown primitive ' + JSON.stringify(type), path.concat(['type']));
            }
            else {
                return option('defaultInvalidTypeProduct');
            }
        }
        else {
            try {
                return types[type](schema, path, resolve, traverse);
            }
            catch (e) {
                if (typeof e.path === 'undefined') {
                    throw new ParseError(e.message, path);
                }
                throw e;
            }
        }
    }
    var copy = {};
    if (Array.isArray(schema)) {
        copy = [];
    }
    for (var prop in schema) {
        if (typeof schema[prop] === 'object' && prop !== 'definitions') {
            copy[prop] = traverse(schema[prop], path.concat([prop]), resolve);
        }
        else {
            copy[prop] = schema[prop];
        }
    }
    return clean(copy);
}
module.exports = traverse;
