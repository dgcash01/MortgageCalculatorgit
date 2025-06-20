// Global variable to store the amortization schedule
let amortizationSchedule = [];

// Global variables for scenario comparison
let currentScenario = {};
let scenarios = [];

// Update loan amount based on home price and down payment
const priceInput = document.getElementById('price');
const downPaymentInput = document.getElementById('downPayment');
const principalInput = document.getElementById('principal');

function formatNumber(num) {
    return Number(num).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 3
    });
}

function updatePrincipal() {
    const price = parseFloat(priceInput.value) || 0;
    const downPayment = parseFloat(downPaymentInput.value) || 0;
    const loanAmount = price - downPayment;
    principalInput.value = loanAmount > 0 ? loanAmount.toFixed(2) : "";
}

if (priceInput && downPaymentInput) { // Ensure elements exist before adding listeners
    priceInput.addEventListener('input', updatePrincipal);
    downPaymentInput.addEventListener('input', updatePrincipal);
}

// Toggle Refinance Fields visibility
function toggleRefinanceFields() {
    const refiDiv = document.getElementById('refinanceFields');
    if (refiDiv) {
        refiDiv.classList.toggle('hidden');
    }
}

// Toggle the chart display (only hide the canvas container, not the button)
function toggleChart() {
    const chartContainer = document.getElementById('chartContainer');
    const toggleBtn = document.getElementById('toggleChartBtn');
    if (chartContainer && toggleBtn) {
        if (chartContainer.classList.contains('hidden')) {
            chartContainer.classList.remove('hidden');
            toggleBtn.textContent = "Hide Chart";
        } else {
            chartContainer.classList.add('hidden');
            toggleBtn.textContent = "Show Chart";
        }
    }
}

// Helper functions for dates
function addMonths(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
}
function formatDate(date) {
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Chart.js variables and custom label plugin
let amortizationChart; // Keep it global for destruction
const customLabelPlugin = {
    id: 'customLabel',
    beforeDraw(chart) {
        const { ctx, chartArea } = chart;
        ctx.save();
        ctx.font = "12px sans-serif";
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillText("Amortization Chart", chartArea.left + 5, chartArea.top + 15);
        ctx.restore();
    }
};

// Generate monthly amortization data for chart (remaining balances)
function getMonthlyAmortizationData(P, r_monthly, n) {
    const data = [];
    for (let t = 0; t <= n; t++) {
        const balance = P * (Math.pow(1 + r_monthly, n) - Math.pow(1 + r_monthly, t)) / (Math.pow(1 + r_monthly, n) - 1);
        data.push(balance);
    }
    return data;
}

// Simulate bi-weekly amortization schedule and collect data points
function getBiWeeklyAmortizationData(P, r_bi, biWeeklyPayment) {
    const data = [];
    let balance = P;
    let period = 0;
    data.push({ month: 0, balance: balance });
    while (balance > 0 && period < 1000 * 26) { // Max periods to prevent infinite loops
        let interestForPeriod = balance * r_bi;
        balance = balance + interestForPeriod - biWeeklyPayment;
        period++;
        let monthEquivalent = period * 14 / 30; // Approximate month for charting
        data.push({ month: monthEquivalent, balance: balance > 0 ? balance : 0 });
    }
    return data;
}

// Render the Chart.js line chart with both datasets
function renderChart(monthlyData, biWeeklyData) {
    const chartCanvas = document.getElementById('amortizationChart');
    if (!chartCanvas) return; // Exit if chart canvas not found
    const ctx = chartCanvas.getContext('2d');

    const labelsMonthly = monthlyData.length > 0 ? monthlyData.map((_, i) => i) : [];
    if (amortizationChart) {
        amortizationChart.destroy();
    }
    amortizationChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labelsMonthly,
            datasets: [
                {
                    label: 'Monthly Payments',
                    data: monthlyData,
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    fill: false,
                    tension: 0.1,
                },
                {
                    label: 'Bi-Weekly Payments',
                    data: biWeeklyData.length > 0 ? biWeeklyData.map(dp => dp.balance) : [],
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    fill: false,
                    tension: 0.1,
                }
            ]
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: 'Mortgage Amortization: Remaining Principal Over Time'
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Months' }
                },
                y: {
                    title: { display: true, text: 'Remaining Principal ($)' },
                    beginAtZero: true,
                }
            }
        },
        plugins: [customLabelPlugin]
    });
}

// Generate a full amortization schedule
function generateAmortizationSchedule(P, r_monthly, monthlyPI, n, monthlyTaxes, monthlyInsurance) {
    let schedule = [];
    let balance = P;
    let currentDate = new Date();
    for (let month = 1; month <= n; month++) {
        let interest = balance * r_monthly;
        let principalPayment = monthlyPI - interest;
        if (principalPayment > balance) { // Final payment adjustment
            principalPayment = balance;
            monthlyPI = interest + balance;
        }
        balance -= principalPayment;
        let paymentDate = addMonths(currentDate, month);
        schedule.push({
            Month: month,
            PaymentDate: formatDate(paymentDate),
            Payment: monthlyPI, // Principal + Interest
            Interest: interest,
            Principal: principalPayment,
            Taxes: monthlyTaxes,
            Insurance: monthlyInsurance,
            TotalPayment: monthlyPI + monthlyTaxes + monthlyInsurance,
            Balance: balance < 0 ? 0 : balance
        });
        if (balance <= 0) break;
    }
    return schedule;
}

// Download the amortization schedule as a CSV file
function downloadAmortizationSchedule() {
    if (!amortizationSchedule || amortizationSchedule.length === 0) {
        alert("Please calculate the mortgage first.");
        return;
    }
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Month,Payment Date,Payment,Interest,Principal,Taxes,Insurance,Total Payment,Balance\n";
    amortizationSchedule.forEach(row => {
        csvContent += `${row.Month},${row.PaymentDate},${row.Payment.toFixed(2)},${row.Interest.toFixed(2)},${row.Principal.toFixed(2)},${row.Taxes.toFixed(2)},${row.Insurance.toFixed(2)},${row.TotalPayment.toFixed(2)},${row.Balance.toFixed(2)}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "amortization_schedule.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Render the amortization schedule as an HTML table
function renderAmortizationTable(schedule) {
    let html = '<div class="overflow-x-auto"><table class="min-w-full border-collapse">';
    html += '<thead><tr class="bg-gray-200">';
    html += '<th class="border px-2 py-1 text-sm">Month</th>';
    html += '<th class="border px-2 py-1 text-sm">Payment Date</th>';
    html += '<th class="border px-2 py-1 text-sm">P&I</th>';
    html += '<th class="border px-2 py-1 text-sm">Interest</th>';
    html += '<th class="border px-2 py-1 text-sm">Principal</th>';
    html += '<th class="border px-2 py-1 text-sm">Taxes</th>';
    html += '<th class="border px-2 py-1 text-sm">Insurance</th>';
    html += '<th class="border px-2 py-1 text-sm">Total Payment</th>';
    html += '<th class="border px-2 py-1 text-sm">Balance</th>';
    html += '</tr></thead><tbody>';
    schedule.forEach(row => {
        html += `<tr class="hover:bg-gray-100">`;
        html += `<td class="border px-2 py-1 text-sm">${row.Month}</td>`;
        html += `<td class="border px-2 py-1 text-sm">${row.PaymentDate}</td>`;
        html += `<td class="border px-2 py-1 text-sm">$${formatNumber(row.Payment)}</td>`;
        html += `<td class="border px-2 py-1 text-sm">$${formatNumber(row.Interest)}</td>`;
        html += `<td class="border px-2 py-1 text-sm">$${formatNumber(row.Principal)}</td>`;
        html += `<td class="border px-2 py-1 text-sm">$${formatNumber(row.Taxes)}</td>`;
        html += `<td class="border px-2 py-1 text-sm">$${formatNumber(row.Insurance)}</td>`;
        html += `<td class="border px-2 py-1 text-sm">$${formatNumber(row.TotalPayment)}</td>`;
        html += `<td class="border px-2 py-1 text-sm">$${formatNumber(row.Balance)}</td>`;
        html += `</tr>`;
    });
    html += '</tbody></table></div>';
    return html;
}

// Toggle display of the interactive amortization table
function toggleAmortizationTable() {
    const tableContainer = document.getElementById('amortizationTableContainer');
    if (tableContainer) {
        if (tableContainer.classList.contains('hidden')) {
            if (!tableContainer.innerHTML.trim()) { // Only render if empty
                tableContainer.innerHTML = renderAmortizationTable(amortizationSchedule);
            }
            tableContainer.classList.remove('hidden');
        } else {
            tableContainer.classList.add('hidden');
        }
    }
}

// Fetch current mortgage market data
async function fetchMarketData() {
    const marketRatesDiv = document.getElementById("marketRates");
    if (!marketRatesDiv) return; // Exit if element not found

    try {
        const response = await fetch("https://www.zillow.com/mortgage/api/#/current-rates-example"); // Placeholder
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        const data = await response.json(); // Assuming JSON response
        let html = `<p>Average Mortgage Rate: <strong>${data.averageRate}%</strong></p>`; // Adjust based on actual API
        html += `<p>Trend: <strong>${data.trend === "up" ? "Rising" : "Falling"}</strong></p>`;
        html += `<p>Last Updated: <strong>${data.lastUpdated}</strong></p>`;
        marketRatesDiv.innerHTML = html;
    } catch (error) {
        console.error("Error fetching market data:", error);
        marketRatesDiv.innerHTML = "<p>Unable to load market data at this time.</p>";
    }
}

function calculateMortgage() {
    const principalVal = parseFloat(principalInput.value); // principalInput is already defined globally
    const annualInterestRate = parseFloat(document.getElementById('interest').value);
    const years = parseFloat(document.getElementById('years').value);
    const annualTaxes = parseFloat(document.getElementById('taxes').value);
    const annualInsurance = parseFloat(document.getElementById('insurance').value);
    const extraMonthly = parseFloat(document.getElementById('extraMonthly').value) || 0;
    const extraYearly = parseFloat(document.getElementById('extraYearly').value) || 0;
    const resultDiv = document.getElementById('result');

    if (isNaN(principalVal) || isNaN(annualInterestRate) || isNaN(years) ||
        isNaN(annualTaxes) || isNaN(annualInsurance) || principalVal <= 0) {
        if (resultDiv) resultDiv.innerHTML = `<p class="text-center text-red-600">Please fill in all required fields correctly.</p>`;
        return;
    }

    const n = years * 12;
    const r_monthly = annualInterestRate / 100 / 12;
    const monthlyPI = principalVal * r_monthly * Math.pow(1 + r_monthly, n) / (Math.pow(1 + r_monthly, n) - 1);
    const monthlyTaxes = annualTaxes / 12;
    const monthlyInsurance = annualInsurance / 12;
    const totalInterestMonthly = (monthlyPI * n) - principalVal;
    const totalTaxes = monthlyTaxes * n;
    const totalInsurance = monthlyInsurance * n;
    const annualPayment = (monthlyPI * 12) + annualTaxes + annualInsurance;
    const payoffDateMonthly = addMonths(new Date(), n);

    // Bi-weekly calculations
    const biWeeklyPayment = monthlyPI / 2;
    const r_bi = Math.pow(1 + annualInterestRate / 100, 1 / 26) - 1; // Effective bi-weekly rate
    let balanceBi = principalVal;
    let totalInterestBi = 0;
    let periodsBi = 0;
    while (balanceBi > 0 && periodsBi < 1000 * 26) {
        let interestForPeriod = balanceBi * r_bi;
        totalInterestBi += interestForPeriod;
        balanceBi = balanceBi + interestForPeriod - biWeeklyPayment;
        periodsBi++;
        if (balanceBi <= 0) break;
    }
    const payoffDateBi = new Date(new Date().getTime() + periodsBi * 14 * 24 * 60 * 60 * 1000);
    const yearsBi = periodsBi / 26;
    const interestSavingsBi = totalInterestMonthly - totalInterestBi;

    // Simulate extra payment scenario
    function simulateExtraPayments(P, r_m, baseMonthlyPI, extraM, extraY) {
        let bal = P;
        let totInt = 0;
        let months = 0;
        while (bal > 0) {
            let interest = bal * r_m;
            totInt += interest;
            let payment = baseMonthlyPI + extraM;
            if ((months + 1) % 12 === 0) {
                payment += extraY;
            }
            if (payment > bal + interest) { // Adjust final payment
                payment = bal + interest;
            }
            let principalPaid = payment - interest;
            bal -= principalPaid;
            months++;
            if (months > 1000 * 12) break; // Safety break
        }
        return { months: months, totalInterest: totInt };
    }
    const extraResult = simulateExtraPayments(principalVal, r_monthly, monthlyPI, extraMonthly, extraYearly);
    const payoffDateExtra = addMonths(new Date(), extraResult.months);
    const interestSavingsExtra = totalInterestMonthly - extraResult.totalInterest;

    // Chart data
    const monthlyData = getMonthlyAmortizationData(principalVal, r_monthly, n);
    const biWeeklyChartData = getBiWeeklyAmortizationData(principalVal, r_bi, biWeeklyPayment);
    renderChart(monthlyData, biWeeklyChartData);

    amortizationSchedule = generateAmortizationSchedule(principalVal, r_monthly, monthlyPI, n, monthlyTaxes, monthlyInsurance);

    currentScenario = {
        homePrice: parseFloat(document.getElementById('price').value) || 0,
        downPayment: parseFloat(document.getElementById('downPayment').value) || 0,
        loanAmount: principalVal.toFixed(2),
        interestRate: annualInterestRate.toFixed(2),
        loanTerm: years,
        monthlyPayment: monthlyPI.toFixed(2),
        totalInterest: totalInterestMonthly.toFixed(2),
        payoffDate: formatDate(payoffDateMonthly),
        extraMonthlyPayment: extraMonthly.toFixed(2),
        extraYearlyPayment: extraYearly.toFixed(2),
        extraPayoffDate: formatDate(payoffDateExtra),
        extraTotalInterest: extraResult.totalInterest.toFixed(2),
        extraInterestSavings: interestSavingsExtra.toFixed(2)
    };

    let resultHTML = `
        <h3 class="text-lg font-semibold">Monthly Payment Schedule</h3>
        <ul class="list-disc list-inside text-sm">
          <li><strong>Monthly Payment (P&I):</strong> $${formatNumber(monthlyPI)}</li>
          <li><strong>Loan Payoff Date:</strong> ${formatDate(payoffDateMonthly)}</li>
          <li><strong>Monthly Taxes:</strong> $${formatNumber(monthlyTaxes)}</li>
          <li><strong>Monthly Home Insurance:</strong> $${formatNumber(monthlyInsurance)}</li>
          <li><strong>Annual Payment Amount:</strong> $${formatNumber(annualPayment)}</li>
          <li><strong>Total Interest Paid:</strong> $${formatNumber(totalInterestMonthly)}</li>
          <li><strong>Total Taxes Paid:</strong> $${formatNumber(totalTaxes)}</li>
          <li><strong>Total Insurance Paid:</strong> $${formatNumber(totalInsurance)}</li>
        </ul>

        <h3 class="text-lg font-semibold mt-6">Bi-weekly Payment Schedule</h3>
        <ul class="list-disc list-inside text-sm">
          <li><strong>Monthly Payment (P&I):</strong> $${formatNumber(monthlyPI)}</li>
          <li><strong>Bi-Weekly Payment:</strong> $${formatNumber(biWeeklyPayment)}</li>
          <li><strong>Estimated Payoff Date:</strong> ${formatDate(payoffDateBi)}</li>
          <li><strong>Effective Term:</strong> ${yearsBi.toFixed(2)} years</li>
          <li><strong>Total Interest Paid (Bi-weekly):</strong> $${formatNumber(totalInterestBi)}</li>
          <li><strong>Interest Savings vs. Monthly:</strong> $${formatNumber(interestSavingsBi)}</li>
        </ul>

    <h3 class="text-lg font-semibold mt-6">Extra Payment Scenario</h3>
    <ul class="list-disc list-inside text-sm">
      <li><strong>Payoff Date with Extra Payments:</strong> ${formatDate(payoffDateExtra)}</li>
      <li><strong>Total Interest Paid (Extra Payments):</strong> $${formatNumber(extraResult.totalInterest)}</li>
      <li><strong>Interest Savings vs. Standard Schedule:</strong> $${formatNumber(interestSavingsExtra)}</li>
    </ul>

    <button onclick="downloadAmortizationSchedule()" class="mt-4 w-full bg-green-500 text-white rounded-md p-2 hover:bg-green-600">
      Download Amortization Schedule (CSV)
    </button>

    <button onclick="toggleAmortizationTable()" class="mt-4 w-full bg-purple-500 text-white rounded-md p-2 hover:bg-purple-600">
      Toggle Amortization Table
    </button>
    <div id="amortizationTableContainer" class="mt-4 hidden"></div>
  `;

    if (document.getElementById('simulateRefinance').checked) {
        const newInterest = parseFloat(document.getElementById('newInterest').value);
        const newYears = parseFloat(document.getElementById('newYears').value);
        const refinanceCost = parseFloat(document.getElementById('refinanceCost').value) || 0;
        if (!isNaN(newInterest) && !isNaN(newYears) && newYears > 0 && newInterest > 0) {
            const n_new = newYears * 12;
            const r_new = newInterest / 100 / 12;
            const monthlyRefiPayment = principalVal * r_new * Math.pow(1 + r_new, n_new) / (Math.pow(1 + r_new, n_new) - 1);
            const totalCostRefi = (monthlyRefiPayment * n_new) + refinanceCost;
            const totalCostCurrent = monthlyPI * n;
            const savingsRefi = totalCostCurrent - totalCostRefi;
            resultHTML += `
        <h3 class="text-lg font-semibold mt-6">Refinance Scenario</h3>
        <ul class="list-disc list-inside text-sm">
          <li><strong>New Monthly Payment:</strong> $${formatNumber(monthlyRefiPayment)}</li>
          <li><strong>Total Cost Over New Term (incl. refinance cost):</strong> $${formatNumber(totalCostRefi)}</li>
          <li><strong>Savings Compared to Original Term:</strong> $${formatNumber(savingsRefi)}</li>
        </ul>
      `;
        } else {
            resultHTML += `<p class="text-sm text-red-600 mt-2">Please fill in valid refinance details.</p>`;
        }
    }
    if (resultDiv) resultDiv.innerHTML = resultHTML;
}

function toggleGlossary() {
    const glossaryContent = document.getElementById('glossaryContent');
    const toggleGlossaryBtn = document.getElementById('toggleGlossaryBtn');
    if (glossaryContent && toggleGlossaryBtn) {
        if (glossaryContent.classList.contains('hidden')) {
            glossaryContent.classList.remove('hidden');
            toggleGlossaryBtn.textContent = "Hide Glossary & Educational Content";
        } else {
            glossaryContent.classList.add('hidden');
            toggleGlossaryBtn.textContent = "Show Glossary & Educational Content";
        }
    }
}

function addCurrentScenario() {
    if (!currentScenario || Object.keys(currentScenario).length === 0 || currentScenario.homePrice === 0) {
        alert("Please calculate a mortgage first to define a scenario.");
        return;
    }
    let scenarioName = prompt("Enter a name for this scenario:", "Scenario " + (scenarios.length + 1));
    if (scenarioName === null || scenarioName.trim() === "") {
        scenarioName = "Scenario " + (scenarios.length + 1);
    }
    const scenarioToAdd = { ...currentScenario, name: scenarioName }; // Use spread syntax
    scenarios.push(scenarioToAdd);
    renderScenarioComparisonTable();
}

function clearScenarios() {
    scenarios = [];
    renderScenarioComparisonTable();
}

function renderScenarioComparisonTable() {
    const tableDiv = document.getElementById('scenarioComparisonTable');
    if (!tableDiv) return;

    if (scenarios.length === 0) {
        tableDiv.innerHTML = "<p>No scenarios added yet.</p>";
        return;
    }
    let html = '<div class="overflow-x-auto"><table class="min-w-full border-collapse">';
    html += '<thead><tr class="bg-gray-200">';
    html += '<th class="border px-2 py-1 text-sm">Scenario Name</th>';
    html += '<th class="border px-2 py-1 text-sm">Home Price ($)</th>';
    html += '<th class="border px-2 py-1 text-sm">Down Payment ($)</th>';
    html += '<th class="border px-2 py-1 text-sm">Loan Amount ($)</th>';
    html += '<th class="border px-2 py-1 text-sm">Interest Rate (%)</th>';
    html += '<th class="border px-2 py-1 text-sm">Loan Term (Years)</th>';
    html += '<th class="border px-2 py-1 text-sm">Monthly Payment ($)</th>';
    html += '<th class="border px-2 py-1 text-sm">Total Interest ($)</th>';
    html += '<th class="border px-2 py-1 text-sm">Payoff Date</th>';
    html += '<th class="border px-2 py-1 text-sm">Extra Monthly ($)</th>';
    html += '<th class="border px-2 py-1 text-sm">Extra Yearly ($)</th>';
    html += '<th class="border px-2 py-1 text-sm">Extra Payoff Date</th>';
    html += '<th class="border px-2 py-1 text-sm">Extra Total Interest ($)</th>';
    html += '<th class="border px-2 py-1 text-sm">Extra Interest Savings ($)</th>';
    html += '</tr></thead><tbody>';
    scenarios.forEach(scenario => {
        html += `<tr class="hover:bg-gray-100">`;
        html += `<td class="border px-2 py-1 text-sm">${scenario.name}</td>`;
        html += `<td class="border px-2 py-1 text-sm">${formatNumber(scenario.homePrice)}</td>`;
        html += `<td class="border px-2 py-1 text-sm">${formatNumber(scenario.downPayment)}</td>`;
        html += `<td class="border px-2 py-1 text-sm">${formatNumber(scenario.loanAmount)}</td>`;
        html += `<td class="border px-2 py-1 text-sm">${formatNumber(scenario.interestRate)}</td>`;
        html += `<td class="border px-2 py-1 text-sm">${formatNumber(scenario.loanTerm)}</td>`;
        html += `<td class="border px-2 py-1 text-sm">$${formatNumber(scenario.monthlyPayment)}</td>`;
        html += `<td class="border px-2 py-1 text-sm">$${formatNumber(scenario.totalInterest)}</td>`;
        html += `<td class="border px-2 py-1 text-sm">${scenario.payoffDate}</td>`;
        html += `<td class="border px-2 py-1 text-sm">$${formatNumber(scenario.extraMonthlyPayment)}</td>`;
        html += `<td class="border px-2 py-1 text-sm">$${formatNumber(scenario.extraYearlyPayment)}</td>`;
        html += `<td class="border px-2 py-1 text-sm">${scenario.extraPayoffDate}</td>`;
        html += `<td class="border px-2 py-1 text-sm">$${formatNumber(scenario.extraTotalInterest)}</td>`;
        html += `<td class="border px-2 py-1 text-sm">$${formatNumber(scenario.extraInterestSavings)}</td>`;
        html += `</tr>`;
    });
    html += '</tbody></table></div>';
    tableDiv.innerHTML = html;
}

// DOMContentLoaded listener
document.addEventListener('DOMContentLoaded', function () {
    renderChart([], []); // Initialize empty chart
    // fetchMarketData(); // Call to fetch market data - Zillow API likely won't work directly, placeholder.

    // Update footer year
    if (document.getElementById('footerYear')) {
        document.getElementById('footerYear').textContent = new Date().getFullYear();
    }

    // Attach event listeners to buttons if they exist - for functions that are globally defined
    const toggleChartBtn = document.getElementById('toggleChartBtn');
    if (toggleChartBtn) toggleChartBtn.addEventListener('click', toggleChart);

    const simulateRefinanceCheckbox = document.getElementById('simulateRefinance');
    if (simulateRefinanceCheckbox) simulateRefinanceCheckbox.addEventListener('click', toggleRefinanceFields);

    const calculateBtn = document.querySelector('button[onclick="calculateMortgage()"]');
    // To avoid attaching multiple listeners if this script is ever run multiple times,
    // we can remove the onclick attribute after attaching the listener.
    if (calculateBtn) {
        calculateBtn.addEventListener('click', calculateMortgage);
        // calculateBtn.removeAttribute('onclick'); // Optional: remove inline handler
    }

    const addScenarioBtn = document.getElementById('addScenarioBtn');
    if (addScenarioBtn) {
        addScenarioBtn.addEventListener('click', addCurrentScenario);
        // addScenarioBtn.removeAttribute('onclick'); // Optional
    }

    const clearScenariosBtn = document.getElementById('clearScenariosBtn');
    if (clearScenariosBtn) {
        clearScenariosBtn.addEventListener('click', clearScenarios);
        // clearScenariosBtn.removeAttribute('onclick'); // Optional
    }

    const toggleGlossaryBtn = document.getElementById('toggleGlossaryBtn');
    if (toggleGlossaryBtn) {
        toggleGlossaryBtn.addEventListener('click', toggleGlossary);
        // toggleGlossaryBtn.removeAttribute('onclick'); // Optional
    }

    // Initial principal update in case values are pre-filled (e.g. by browser)
    if (typeof updatePrincipal === "function") { // Check if function exists
      updatePrincipal();
    }
});

// Note: downloadAmortizationSchedule and toggleAmortizationTable are called from dynamically generated HTML,
// so they need to remain globally accessible or have their event listeners attached when the buttons are created.
// For simplicity, they remain global here.
