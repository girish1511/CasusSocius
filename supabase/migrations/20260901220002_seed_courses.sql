-- Seeds initial subject tabs so the UI has real courses on first load.
alter table courses add constraint courses_name_key unique (name);

insert into courses (name, description)
values
  ('Microeconomics', null),
  ('Accounting', null),
  ('Marketing', null)
on conflict (name) do nothing;
