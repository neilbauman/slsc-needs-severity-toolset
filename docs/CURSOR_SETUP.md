# Cursor AI Setup Guide

This guide explains how Cursor AI is configured to work with your codebase, Supabase database, and GitHub repository.

## What Has Been Set Up

### 1. `.cursorrules` File
Located in the project root, this file provides Cursor AI with:
- **Project context**: Technology stack, architecture patterns
- **Database schema**: Complete documentation of all tables and their relationships
- **RPC functions**: All Supabase RPC functions with parameters and usage examples
- **Code patterns**: Common patterns for Supabase client usage, error handling, etc.
- **Conventions**: File structure, naming conventions, and best practices

Cursor AI will automatically read this file to understand your codebase better.

### 2. `docs/SUPABASE_SCHEMA.md`
Comprehensive documentation of:
- All database tables with column details
- All RPC functions with parameters and return types
- Data relationships and common queries
- Development notes and best practices

This serves as both documentation for developers and context for Cursor AI.

## How Cursor Uses This Information

### Code Review & Editing
When you ask Cursor to review or edit code, it will:
1. Reference `.cursorrules` to understand project patterns
2. Check `docs/SUPABASE_SCHEMA.md` for database structure
3. Understand RPC function signatures and usage
4. Follow established code patterns and conventions

### Supabase Integration
Cursor can now:
- **Understand your schema**: Knows all tables, columns, and relationships
- **Work with RPCs**: Understands parameters, return types, and usage patterns
- **Suggest proper queries**: Can write correct Supabase queries based on your schema
- **Handle errors**: Knows common error patterns and how to handle them

### GitHub Integration
Cursor already has access to your codebase through the workspace. The `.cursorrules` file helps it:
- Understand code patterns when reviewing PRs
- Maintain consistency across the codebase
- Follow TypeScript and Next.js best practices
- Respect your project's architecture

## Using Cursor Effectively

### Example Prompts

**Database Queries:**
```
"Create a query to get all numeric datasets for ADM3 level"
"Add a new RPC function to aggregate scores by region"
```

**Code Review:**
```
"Review the NumericScoringModal component for best practices"
"Check if this RPC call handles errors correctly"
```

**Feature Development:**
```
"Add a new scoring method that uses percentile ranking"
"Create a component to visualize dataset distributions"
```

**Schema Changes:**
```
"Add a new column to the datasets table for data quality score"
"Create a new table to track dataset version history"
```

## Keeping Documentation Updated

When you make changes to:
- **Database schema**: Update `supabase/schema.sql` and `docs/SUPABASE_SCHEMA.md`
- **RPC functions**: Update both `.cursorrules` and `docs/SUPABASE_SCHEMA.md`
- **Code patterns**: Update `.cursorrules` with new patterns

## Environment Variables

Make sure your `.env.local` file contains:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

Cursor can reference these in code suggestions, but won't expose actual values.

## Tips for Best Results

1. **Be specific**: Reference table names, RPC functions, or components by name
2. **Provide context**: Mention which part of the application you're working on
3. **Reference existing code**: "Similar to how NumericScoringModal does X..."
4. **Ask for explanations**: "Why does this RPC use this parameter structure?"

## Troubleshooting

If Cursor doesn't seem to understand your codebase:
1. Check that `.cursorrules` is in the project root
2. Verify `docs/SUPABASE_SCHEMA.md` is up to date
3. Restart Cursor to reload configuration
4. Be explicit about which files/components you're working with

## Next Steps

1. Review the `.cursorrules` file to ensure it matches your preferences
2. Update `docs/SUPABASE_SCHEMA.md` if you have additional tables or RPCs
3. Test Cursor by asking it to review or modify code
4. Keep documentation updated as your project evolves

