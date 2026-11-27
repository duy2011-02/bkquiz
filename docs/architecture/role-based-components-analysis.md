# Role-Based Components Architecture Analysis

> **Ghi chú (27/11/2026):** tài liệu phân tích cũ, giữ làm lịch sử. Vai trò trợ giảng (TA) nhắc tới ở đây đã bị gỡ ở Đợt 7; quyền hiện hành xem [`docs/security.md`](../security.md) mục 3.1b–3.1c.

## 🔍 Current State

### Pattern 1: Separate Components (Dashboard)
- ✅ `TeacherDashboard.tsx` - Server component, teacher-specific
- ✅ `StudentDashboard.tsx` - Server component, student-specific
- ✅ `page.tsx` - Router, conditionally renders based on role

**Benefits:**
- Clear separation of concerns
- Easy to read and maintain
- Better performance (only load needed code)
- Easy to test
- Scales well for new roles

### Pattern 2: Shared Component with Conditional Rendering
- ⚠️ `ClassesPanel.tsx` - Client component, `role` prop
- ⚠️ `ClassDetailPanel.tsx` - Client component, `role` prop + `isOwner`/`isStudent` checks

**Issues:**
- Complex conditional logic scattered throughout
- Harder to read and maintain
- All code loaded even if not used
- Mixed concerns (teacher + student logic in one file)

---

## 📊 Analysis: ClassDetailPanel

### Current Complexity
```typescript
// Multiple role checks throughout:
- isOwner (classInfo.userRole === 'teacher')
- isStudent (classInfo.userRole === 'student')
- role prop from parent
- Conditional rendering in multiple places:
  - Header buttons (Create Session)
  - Stats cards (different colors)
  - Tabs (Settings tab only for owner)
  - Members tab (Add Member button)
  - Sessions tab (different buttons/links)
  - Create Session modal (only for owner)
```

### Use Cases Comparison

#### Teacher Use Cases:
1. View class info (owner badge)
2. Manage members (add, remove, change roles)
3. View all sessions
4. Create new sessions
5. Access settings (edit name, regenerate code, archive)

#### Student Use Cases:
1. View class info (member badge)
2. View members list (read-only)
3. View sessions (with join buttons)
4. Join active sessions
5. View past sessions

**Key Difference:** Teacher = Management, Student = Participation

---

## 🎯 Recommendation: **SEPARATE COMPONENTS**

### Why?

1. **Consistency with Dashboard Pattern**
   - Dashboard đã tách riêng → ClassDetail nên follow pattern
   - Easier for developers to understand codebase structure

2. **Clear Separation of Concerns**
   - Teacher: Management features
   - Student: Participation features
   - No mixed logic

3. **Better Performance**
   - Only load code needed for current role
   - Smaller bundle size per role

4. **Easier to Maintain**
   - Changes to teacher features don't affect student code
   - Easier to review PRs (clear scope)
   - Easier to test (isolated components)

5. **Better Scalability**
   - Easy to add new roles (TA, Admin, etc.)
   - Each role can have completely different UI

6. **Code Clarity**
   - No `if (isOwner) ... else ...` scattered everywhere
   - Each component focuses on one role's needs

### Structure Proposal

```
dashboard/classes/[classId]/
├── page.tsx                    # Router, conditionally render
├── TeacherClassDetail.tsx      # Teacher-specific (server component)
├── StudentClassDetail.tsx      # Student-specific (server component)
└── shared/
    ├── ClassHeader.tsx         # Shared UI (name, code, stats)
    ├── MembersList.tsx         # Shared UI (different actions per role)
    └── SessionsList.tsx        # Shared UI (different buttons per role)
```

**OR simpler:**

```
dashboard/classes/[classId]/
├── page.tsx                    # Router, conditionally render
├── TeacherClassDetail.tsx      # All teacher logic
└── StudentClassDetail.tsx      # All student logic
```

---

## 🔄 Migration Strategy

### Phase 1: Extract Shared Components
- Extract `ClassHeader` (name, code, stats)
- Extract `MembersList` (with role-specific actions)
- Extract `SessionsList` (with role-specific buttons)

### Phase 2: Create Role-Specific Components
- `TeacherClassDetail.tsx` - Uses shared + teacher-specific
- `StudentClassDetail.tsx` - Uses shared + student-specific

### Phase 3: Update Router
- `page.tsx` conditionally renders based on role

---

## 📋 Comparison Table

| Aspect | Shared Component | Separate Components |
|--------|-----------------|---------------------|
| **Code Reuse** | ✅ High | ⚠️ Medium (can share utilities) |
| **Maintainability** | ⚠️ Medium (complex conditionals) | ✅ High (clear separation) |
| **Performance** | ⚠️ Loads all code | ✅ Only loads needed code |
| **Readability** | ⚠️ Mixed concerns | ✅ Clear, focused |
| **Scalability** | ⚠️ Harder to add roles | ✅ Easy to add roles |
| **Testing** | ⚠️ Need to test all branches | ✅ Isolated tests |
| **Consistency** | ⚠️ Different from Dashboard | ✅ Matches Dashboard pattern |

---

## ✅ Final Recommendation

**Tách riêng thành `TeacherClassDetail` và `StudentClassDetail`**

**Lý do:**
1. Consistency với Dashboard pattern
2. ClassDetailPanel đã quá phức tạp với nhiều conditional logic
3. Teacher và Student có use cases khác nhau rõ ràng
4. Dễ maintain và scale hơn
5. Better performance

**Trade-off:**
- Có thể có một chút code duplication, nhưng có thể share utilities/components
- Worth it vì clarity và maintainability

---

## 🎨 Implementation Plan

1. **Create `TeacherClassDetail.tsx`**
   - Move all teacher-specific logic
   - Include: Create Session modal, Add Member, Settings tab

2. **Create `StudentClassDetail.tsx`**
   - Move all student-specific logic
   - Include: Join buttons, read-only views

3. **Extract shared components** (optional but recommended)
   - `ClassHeader` - Basic info display
   - `MembersList` - Members display (with role-specific actions)
   - `SessionsList` - Sessions display (with role-specific buttons)

4. **Update `page.tsx`**
   - Conditionally render based on role

5. **Delete old `ClassDetailPanel.tsx`**

---

## 📝 Notes

- This pattern should be applied to other shared components too:
  - `ClassesPanel` → `TeacherClassesPanel` + `StudentClassesPanel`
  - Any other role-mixed components

- Consider creating a `shared/` directory for truly shared UI components

