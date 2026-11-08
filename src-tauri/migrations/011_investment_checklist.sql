CREATE TABLE checklist_questions (
 id TEXT PRIMARY KEY NOT NULL,
 question TEXT NOT NULL,
 sort_order INTEGER NOT NULL
);
CREATE TABLE security_checklist_answers (
 security_id TEXT NOT NULL REFERENCES securities(id) ON DELETE CASCADE,
 question_id TEXT NOT NULL REFERENCES checklist_questions(id) ON DELETE CASCADE,
 answer TEXT NOT NULL CHECK (answer IN ('yes','no','na')),
 PRIMARY KEY (security_id,question_id)
);
