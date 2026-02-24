This document contains proposals for specifying API response behavior in HTTP header of an API call. This is called the API response field response mechanism. The mechanism consists of several sub-proposals for different aspect of the mechanism.

Purpose of the mechanism

A single API response is represented either as a single JSON object, or as a JSON array with any number (top-level) objects, each of which may include any number of children. The response field selection mechanism allows a developer to objects in the full response tree will be returned and which ones will be omitted).

General requirements/recommendations for the mechanism

Easy to understand

The semantics of the mechanism should be clear (e.g. few rules, no exceptions).

The API header fields used in the mechanism should be easy to read (primarily for a human).

For common use cases, the developer is required to supply minimal data in the header fields (and for more advanced use-cases, the developer may need to supply more data in the header fields).

Easy to use

The API header should be easy to write (for a human).

Stay close to common/best practices for recognizability (and developer-conversion from other APIs).

It should be easy to discover which fields are available for potential field inclusion/exclusion.

Operational cost

TomTom needs to be able to specify that specific resource-expensive fields or sub-trees are only returned when explicitly asked for (to avoid accidental operational cost).

Usage cost

TomTom needs to be able to specify that specific data-consuming fields or sub-trees are only returned when explicitly asked for (to avoid accidental data consumption).

The developer needs to be able to specify that specific fields or sub-trees are not returned (to reduce data consumption).

Compatibility

When TomTom adds fields/sub-trees to an API, the semantics of the API should not change (backward compatible semantics).

When TomTom adds fields/sub-trees to an API, the performance of the API should not change (backward compatible performance).

Semantics and syntax

This describes the semantics and syntax of how field inclusion and exclusion are defined.

Semantics of field inclusion header

The semantic of the field inclusion header are defined by 3 rules:

Any field, including its sub-tree, that is supplied in the field inclusion header will be returned in the response, if it is applicable for that response (nullable fields in a particular response may always be omitted). Rule 2 still applies.

If a field is marked EXPLICIT in the API documentation, it must be explicitly supplied (not implicitly by including its parent) in the field inclusion header before it can be returned in a response.

A “*” can be specified as the only object in the field inclusion header to return all top-level fields and their sub-trees (excluding field marked as EXPLICIT in the API documentation).

Notes and rationale:

The purpose of the “*” is top-level field discovery only.

The “*” cannot be used in combination with any other field, it can only exist as a single “*” argument.

Specifying “*” does not include fields marked as EXPLICIT. Returning those would make it seem that the explicit fields are part of a regular response. The developer will subsequently not understand why they are never returned when their parent is specified in the inclusion list. In order to use them, you always need to specify them explicitly. This includes looking them up in the API documentation.

Semantics of field exclusion header

Any field, including its entire sub-tree, that is supplied in the field exclusion header will be omitted from the response (regardless of the field inclusion list).

Notes and rationale:

The field exclusion is applied to the result of the field inclusion list. This means that any fields that were explicitly mentioned in the filed inclusion list but that are part of a parent that is excluded in the field exclusion list, are still excluded. The exclusion list overrules everything.

The exclusion list allows a developer to remove “known clutter” from a response without having to specify exactly which remaining fields it needs to get (which may include a lot of remaning fields).

The “*” is not allowed in the exclusion list. The purpose of the “*” is top-level field discovery only.

Syntax for the field inclusion header

The field inclusion header is specified in the Attributes field.

The format is “listed dot-notation”, in semi-formal notation:

field-inclusion-list ::= field-list | '*'
field-list ::= field | field ',' field-list |
field ::= name | name '.' field

Notes:

Listed field names must exist in the JSON definition (HTTP 400 error if not).

Field names may occur multiple times (not recommended, but not an error).

Examples

Given this full JSON object that can be returned (* means tagged as EXPLICIT field):

        A
        |
     B-----C
     |     |
   X*--Y   Z
   |
 P---Q*

Examples of field inclusion values (++ denotes the field inclusion list):

++ A -- include all non-explicit fields from A
>> A.B.Y, A.C.Z

++ * -- same as "A"
>> A.B.Y, A.C.Z

++ A, A.B.X -- include explicit field A.B.X
>> A.B.X.P, A.B.Y, A.C.Z

++ A, A.B.X.Q -- include explicit field A.B.X.Q
>> A.B.X.Q, A.B.Y, A.C.Z

Syntax for the field exclusion header

The field inclusion header is specified in the Attributes-exclude field.

The format is “listed dot-notation”, in semi-formal notation:

field-exclusion-list ::= field-list             -- (no '*' is allowed)
field-list ::= field | field ',' field-list |
field ::= name | name '.' field

Examples

Example of the field exclusion list (++ denotes the field inclusion list, -- denote the exclusion list):

++ A   -- include all non-explicit fields from A
-- A.C -- exclude specific field and sub-tree
>> A.B.Y

++ A, A.B.X -- include explicit field A.B.X
-- A.B.X.P -- remove specific field
>> A.B.Y, A.C.Z

Requirements matrix

+Requirement



Comment

Easy to understand

+

There are very few rules: 2 for inclusion (plus 1 for “*”), 1 for exclusion.



+

The dot-notation is trivial to read for humans. (It can also easily be read by a computer).



+

Responses for common use-cases can be made optimal by the use of EXPLICIT fields in the definition.

Easy to use

+

The dot-notation is trivial to write for humans.



+

The dot notation and inclusion principles are very close to what Google does.



-

The EXPLICIT and “*” mechanisms do not exist for the competition, so they may not be known to developers.



+

The semantic of the EXPLICIT tag are extremely simple (1 rule), which should increase usability.



+

Discovery of top-level field is made very easy through the use of the “*”.

Operational cost

+

The use of EXPLICIT fields allows not including resource-expensive fields by accident.

Usage cost

+

The use of EXPLICIT fields allows not including data consumption intensive fields by accident.



+

The use of a field exclusion list allows a developer to optimize the returned response fields efficiently, if the response would contain many fields. (Alternatively, the develop can use the inclusion list to only specify the fields they need, but the combination of using both can make the header smaller and more readable).

Compatibility

+

If added fields are marked as EXPLICIT in the API, then existing clients will never receive them unless they explicitly ask for them, keeping the API 100% backward compatible. As no fields are unexpectedly added, the client performance will also not be affected.
