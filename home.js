
function createElement(tag, className, text)
{
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
}

// "2026-10-20" -> "10/20"
// Split the text instead of using new Date(), which reads it as UTC and can show the day before
function formatDueDate(dueDate)
{
    const [, month, day] = dueDate.split('-');   // skip the year
    return `${month}/${day}`;
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
        createElement('span', 'due', task.dueDate ? `Due: ${formatDueDate(task.dueDate)}` : 'No due date')
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

// One labeled input for the new task form
function createField(labelText, inputAttributes)
{
    const label = createElement('label', 'field');
    const input = createElement('input');
    Object.assign(input, inputAttributes);
    label.append(createElement('span', null, labelText), input);
    return label;
}

function createNewTask()
{
    const li = createElement('li', 'task editor');
    li.id = 'newTaskCard';

    const form = createElement('form');

    // Input names match the database columns, so FormData can read them later
    form.append(
        createElement('h3', 'name', 'New task'),
        createField('Course', { name: 'course', type: 'text', required: true, placeholder: 'CS 101' }),
        createField('Task name', { name: 'name', type: 'text', required: true, placeholder: 'Lab 3' }),
        createField('Due date', { name: 'dueDate', type: 'date' }),
        createField('Estimated hours', { name: 'estimatedTotalHours', type: 'number', min: 0, step: 0.5 })
    );

    // Discard to remove card, save to submit request
    const actions = createElement('div', 'editor-actions');
    const discardButton = createElement('button', null, 'Discard');
    discardButton.type = 'button';
    const saveButton = createElement('button', 'accent-btn', 'Save');
    saveButton.type = 'submit';
    actions.append(discardButton, saveButton);

    // Error message above the buttons, hidden by default
    const errorText = createElement('p', 'form-error');
    errorText.hidden = true;

    form.append(errorText, actions);

    discardButton.addEventListener('click', function() {
        li.remove();

        // Bring back "No tasks yet." if the list is empty again
        if (document.getElementById('taskList').children.length === 0)
            showStatus('No tasks yet.');
    });

    // Placeholder until saving is written: stop the page from reloading
    form.addEventListener('submit', async function(event) {
        event.preventDefault();

        // Transform the form into data
        const data = Object.fromEntries(new FormData(form));

        // Clean and formalize data
        const task = {
            course: data.course.trim(),
            name: data.name.trim(),
            dueDate: data.dueDate || null,
            estimatedTotalHours: data.estimatedTotalHours === '' ? null: Number(data.estimatedTotalHours)
        };

        // Prevent double-saving, clear any old error
        saveButton.disabled = true;
        errorText.hidden = true;

        try
        {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(task)
            });

            if (!response.ok)
            {
                // Add red error text to new task card using the body text in response
                console.log("Request Error");
                errorText.textContent = await response.text();
                errorText.hidden = false;
                saveButton.disabled = false;
                return;
            }

            // Saved: hard reload
            loadTasks();
        }
        catch(err)
        {
            // fetch only throws when the server can't be reached
            console.log(err);
            errorText.textContent = 'Could not reach the server.';
            errorText.hidden = false;
            saveButton.disabled = false;
        }
    });

    li.append(form);
    return li;
}

// Bring an already-open new task card back into view
function refocusNewTask(card)
{
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    card.querySelector('input').focus({ preventScroll: true });

    // Quick gold pulse so it's obvious which card is open
    // card.animate(
    //     [{ boxShadow: '0 0 0 0 var(--accent)' }, { boxShadow: '0 0 0 6px transparent' }],
    //     { duration: 500, easing: 'ease-out' }
    // );
}

async function loadTasks()
{
    const loader = document.getElementById('loader');
    const status = document.getElementById('status');
    const tasksBody = document.getElementById('taskList');
    tasksBody.replaceChildren();

    // Make loader visible, hide any old message
    loader.hidden = false;
    status.hidden = true;

    // Forced wait to show off the loading dial
    // await new Promise(resolve => setTimeout(resolve, 1500));

    try
    {
        const response = await fetch('/api/tasks');
        const tasks = await response.json();

        for (const task of tasks)
        {
            tasksBody.append(createTaskElement(task));
        }

        if (tasks.length === 0)
            showStatus('No tasks yet.');
    }
    catch (err)
    {
        console.error(err);
        showStatus('Could not load tasks.');
    }

    // Hide the loader instead of removing it, so loadTasks() can run again
    loader.hidden = true;
}

// Show a message under the tasks header
function showStatus(text)
{
    const status = document.getElementById('status');
    status.textContent = text;
    status.hidden = false;
}

const themeButton = document.getElementById('darkMode');
themeButton.addEventListener('click', function() {
    document.body.classList.toggle('dark');
});

const newTaskButton = document.getElementById('addTaskButton');
newTaskButton.addEventListener('click', function() {
    const newTaskCard = document.getElementById('newTaskCard');
    if (newTaskCard == null)
    {
        // Card not opened yet, create it
        const card = createNewTask();
        document.getElementById('taskList').prepend(card);
        document.getElementById('status').hidden = true;   // hide "No tasks yet."
        card.querySelector('input').focus();
    }
    else
    {
        // Re-focus card form
        refocusNewTask(newTaskCard);
    }
});

loadTasks();
