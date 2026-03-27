# HTTP Client Template Examples

The HTTP Client now supports **inja template syntax** for dynamic URL and body generation based on incoming JSON data.

## Template Syntax

Inja uses Jinja2-like syntax for templates:

- **Variables**: `{{ variable }}`
- **Conditionals**: `{% if condition %} ... {% else %} ... {% endif %}`
- **Loops**: `{% for item in items %} ... {% endfor %}`
- **Filters**: `{{ variable | upper }}`

## Usage Examples

### 1. Simple Variable Substitution

**Input Data:**

```json
{
  "url": "https://api.example.com/users/{{ userId }}",
  "userId": "12345"
}
```

**Rendered URL:**

```
https://api.example.com/users/12345
```

### 2. Multiple Variables

**Input Data:**

```json
{
  "url": "https://api.example.com/{{ resource }}/{{ id }}/{{ action }}",
  "resource": "users",
  "id": "42",
  "action": "profile"
}
```

**Rendered URL:**

```
https://api.example.com/users/42/profile
```

### 3. Conditional URLs

**Input Data:**

```json
{
  "url": "https://{% if isProd %}api{% else %}api-dev{% endif %}.example.com/data",
  "isProd": false
}
```

**Rendered URL:**

```
https://api-dev.example.com/data
```

### 4. Default Values

**Input Data:**

```json
{
  "url": "https://api.example.com/users/{{ userId | default('anonymous') }}",
  "userId": null
}
```

**Rendered URL:**

```
https://api.example.com/users/anonymous
```

### 5. Query Parameters from Data

**Input Data:**

```json
{
  "url": "https://api.example.com/search?q={{ query }}&limit={{ limit }}",
  "query": "test",
  "limit": 10
}
```

**Rendered URL:**

```
https://api.example.com/search?q=test&limit=10
```

### 6. Path Segments from Arrays

**Input Data:**

```json
{
  "url": "https://api.example.com/{% for segment in path %}{{ segment }}/{% endfor %}data",
  "path": ["v1", "users", "profile"]
}
```

**Rendered URL:**

```
https://api.example.com/v1/users/profile/data
```

### 7. Complex Conditional Logic

**Input Data:**

```json
{
  "url": "https://api.example.com/{{ resource }}{% if id %}/{{ id }}{% endif %}{% if action %}?action={{ action }}{% endif %}",
  "resource": "users",
  "id": "123",
  "action": "edit"
}
```

**Rendered URL:**

```
https://api.example.com/users/123?action=edit
```

## Configuration Examples

### Static URL (No Template)

```json
{
  "url": "https://api.example.com/fixed-endpoint"
}
```

Regular URLs work as before - no template processing needed.

### Configure Default URL Template

```json
{
  "configure": {
    "url": "https://api.example.com/{{ endpoint }}",
    "userAgent": "MyApp/1.0"
  }
}
```

Then process with:

```json
{
  "endpoint": "users"
}
```

## Advanced Features

### Filters

- `{{ text | upper }}` - Convert to uppercase
- `{{ text | lower }}` - Convert to lowercase
- `{{ value | default('fallback') }}` - Provide default value
- `{{ number | round(2) }}` - Round numbers

### Expressions

- `{{ a + b }}` - Arithmetic
- `{{ a == b }}` - Comparisons
- `{{ a and b }}` - Logical operations

### Functions

- `{{ length(array) }}` - Get array length
- `{{ first(array) }}` - Get first element
- `{{ last(array) }}` - Get last element

## Error Handling

If template rendering fails, the original template string is returned unchanged and an error is logged to stderr:

```
HTTPClient template rendering error: [error message]
```

## More Information

Full inja documentation: https://github.com/pantor/inja
