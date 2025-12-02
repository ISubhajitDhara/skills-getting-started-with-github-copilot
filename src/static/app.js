document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");

  // Helper to show messages
  function showMessage(text, type = "info") {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");
    setTimeout(() => messageDiv.classList.add("hidden"), 5000);
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message and dropdown options
      activitiesList.innerHTML = "";
      // reset activity select while keeping placeholder
      activitySelect.innerHTML = "<option value=''>-- Select an activity --</option>";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        // Build participants list items with delete button
        const participantsHtml = details.participants.length
          ? `<ul class="participants-list">
               ${details.participants
                 .map(
                   (p) =>
                     `<li class="participant-item"><span class="participant-email">${p}</span><button class="delete-btn" data-activity="${encodeURIComponent(
                       name
                     )}" data-email="${encodeURIComponent(p)}" title="Unregister">🗑️</button></li>`
                 )
                 .join("")}
             </ul>`
          : `<p class="no-participants">No participants yet.</p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> <span class="spots-left">${spotsLeft}</span> spots left</p>

          <div class="participants">
            <h5 class="participants-heading">Participants <span class="participants-count">(${details.participants.length})</span></h5>
            ${participantsHtml}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);

        // Attach delete handlers for this card
        const deleteButtons = activityCard.querySelectorAll(".delete-btn");
        deleteButtons.forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            const encActivity = btn.dataset.activity; // already encoded
            const encEmail = btn.dataset.email; // already encoded
            try {
              const res = await fetch(`/activities/${encActivity}/participants?email=${encEmail}`, {
                method: "DELETE",
              });

              const data = await res.json();
              if (res.ok) {
                // remove the participant item from the DOM
                const li = btn.closest(".participant-item");
                if (li) li.remove();

                // update participants count and spots left
                const card = btn.closest(".activity-card");
                if (card) {
                  const countSpan = card.querySelector(".participants-count");
                  const spotsSpan = card.querySelector(".spots-left");
                  if (countSpan) {
                    // decrement numeric value inside parentheses
                    const m = countSpan.textContent.match(/\((\d+)\)/);
                    if (m) {
                      const newCount = Math.max(0, parseInt(m[1], 10) - 1);
                      countSpan.textContent = `(${newCount})`;
                    }
                  }
                  if (spotsSpan) {
                    const current = parseInt(spotsSpan.textContent, 10);
                    if (!isNaN(current)) spotsSpan.textContent = current + 1;
                  }
                }

                showMessage(data.message, "success");
              } else {
                showMessage(data.detail || "Failed to unregister", "error");
              }
            } catch (err) {
              console.error("Error unregistering:", err);
              showMessage("Failed to unregister. Please try again.", "error");
            }
          });
        });
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Create a participant list item element (with delete handler)
  function createParticipantListItem(activityName, email) {
    const li = document.createElement("li");
    li.className = "participant-item";

    const span = document.createElement("span");
    span.className = "participant-email";
    span.textContent = email;

    const btn = document.createElement("button");
    btn.className = "delete-btn";
    btn.title = "Unregister";
    btn.textContent = "🗑️";
    btn.dataset.activity = encodeURIComponent(activityName);
    btn.dataset.email = encodeURIComponent(email);

    btn.addEventListener("click", async () => {
      try {
        const res = await fetch(`/activities/${btn.dataset.activity}/participants?email=${btn.dataset.email}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (res.ok) {
          li.remove();
          // update counts
          const card = document.querySelectorAll(".activity-card")
            .forEach((c) => {
              const h = c.querySelector("h4");
              if (h && h.textContent === activityName) {
                const countSpan = c.querySelector(".participants-count");
                const spotsSpan = c.querySelector(".spots-left");
                if (countSpan) {
                  const m = countSpan.textContent.match(/\((\d+)\)/);
                  if (m) countSpan.textContent = `(${Math.max(0, parseInt(m[1], 10) - 1)})`;
                }
                if (spotsSpan) {
                  const current = parseInt(spotsSpan.textContent, 10);
                  if (!isNaN(current)) spotsSpan.textContent = current + 1;
                }
              }
            });

          showMessage(data.message, "success");
        } else {
          showMessage(data.detail || "Failed to unregister", "error");
        }
      } catch (err) {
        console.error("Error unregistering:", err);
        showMessage("Failed to unregister. Please try again.", "error");
      }
    });

    li.appendChild(span);
    li.appendChild(btn);
    return li;
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Try to update the DOM immediately for the activity card
        const activityName = activity;
        const card = Array.from(document.querySelectorAll(".activity-card")).find(
          (c) => c.querySelector("h4") && c.querySelector("h4").textContent === activityName
        );

        if (card) {
          const list = card.querySelector(".participants-list");
          if (list) {
            // append new participant item
            const li = createParticipantListItem(activityName, email);
            list.appendChild(li);
          } else {
            // replace 'no participants' paragraph with a new list
            const noP = card.querySelector(".no-participants");
            const wrapper = card.querySelector(".participants");
            const newList = document.createElement("ul");
            newList.className = "participants-list";
            newList.appendChild(createParticipantListItem(activityName, email));
            if (noP) noP.replaceWith(newList);
            else if (wrapper) wrapper.appendChild(newList);
          }

          // update counts and spots
          const countSpan = card.querySelector(".participants-count");
          const spotsSpan = card.querySelector(".spots-left");
          if (countSpan) {
            const m = countSpan.textContent.match(/\((\d+)\)/);
            if (m) countSpan.textContent = `(${parseInt(m[1], 10) + 1})`;
          }
          if (spotsSpan) {
            const current = parseInt(spotsSpan.textContent, 10);
            if (!isNaN(current)) spotsSpan.textContent = Math.max(0, current - 1);
          }
        } else {
          // if the card isn't present (maybe filtered out), refresh full list
          fetchActivities();
        }
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  fetchActivities();
});

