
function createElement(tag, className, text)
{
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
}

function createTaskElement(task)
{
    const logged = task.loggedHours;
    const estimated = task.estimatedTotalHours;

    // Main Card (tabIndex lets keyboard/touch users "focus" it to see details)
    const li = createElement('li', 'task');
    li.tabIndex = 0;

    // Title / top
    const top = createElement('div', 'task-top');
    top.append(
        createElement('span', 'course', task.course),
        createElement('span', 'due', task.dueDate ? `Due ${task.dueDate}` : 'No due date')
    );

    // Progress bar
    const bar = createElement('div', 'bar');
    const fill = createElement('span');
    fill.style.width = (estimated ? Math.min(logged / estimated * 100, 100) : 0) + '%';
    bar.append(fill);

    // Details, hidden until hover: a list of label/value pairs
    const dl = createElement('dl');
    const rows = [
        ['Logged',    `${logged} h`],
        ['Estimated', estimated ? `${estimated} h` : '—'],
        ['Remaining', estimated ? `${Math.max(estimated - logged, 0)} h` : '—']
    ];
    for (const [label, value] of rows)
    {
        dl.append(createElement('dt', null, label), createElement('dd', null, value));
    }

    // Two wrappers so the CSS can animate the height smoothly
    const details = createElement('div', 'details');
    const detailsInner = createElement('div');
    detailsInner.append(dl);
    details.append(detailsInner);

    // Assemble
    li.append(
        top,
        createElement('h3', 'name', task.name),
        bar,
        details
    );

    return li;
}

async function loadTasks()
{
    const loader = document.getElementById('loader');
    const tasksBody = document.getElementById('taskList');

    // Forced wait to show off the loading dial
    await new Promise(resolve => setTimeout(resolve, 1500));

    try
    {
        const response = await fetch('/api/tasks');
        const tasks = await response.json();

        tasksBody.replaceChildren();
        for (const task of tasks)
        {
            tasksBody.append(createTaskElement(task));
        }

        if (tasks.length === 0)
            loader.after(createElement('p', 'status', 'No tasks yet.'));
    }
    catch (err)
    {
        console.error(err);
        loader.after(createElement('p', 'status', 'Could not load tasks.'));
    }

    loader.remove();
}

darkButton = document.getElementById('darkMode');
darkButton.addEventListener('click', function() {
    document.body.classList.toggle('dark')
})

loadTasks();
