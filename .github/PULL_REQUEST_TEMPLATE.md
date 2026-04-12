## Summary

<!-- What does this PR do? 1-3 bullet points. -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Enhancement to existing feature
- [ ] Refactoring (no behavior change)
- [ ] Documentation
- [ ] Other: ___

## Testing

<!-- How was this tested? Check all that apply. -->

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing (describe below)
- [ ] E2E tests added/updated

## Checklist

- [ ] Tenant isolation maintained (`WHERE tenant_id = ?` on all queries)
- [ ] No `any` types introduced
- [ ] Monetary values use `decimal(19,4)`
- [ ] API endpoints have Zod validation
- [ ] UI has loading, error, and empty states
- [ ] No secrets or credentials committed
