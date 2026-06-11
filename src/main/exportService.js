/**
 * Compiles a list of tasks into the requested document buffer.
 * Heavy modules (xlsx, docx, pdfkit) are lazy-loaded within functions to maximize startup speed.
 * @param {Array} tasks List of tasks
 * @param {string} format Format type (csv, xlsx, pdf, docx, txt)
 * @returns {Promise<Buffer>} The compiled file buffer
 */
async function exportTasks(tasks, format) {
  const normFormat = format.toLowerCase();
  
  switch (normFormat) {
    case 'csv':
      return exportCSV(tasks);
    case 'xlsx':
      return exportExcel(tasks);
    case 'pdf':
      return await exportPDF(tasks);
    case 'docx':
      return await exportWord(tasks);
    case 'txt':
    default:
      return exportText(tasks);
  }
}

function exportCSV(tasks) {
  const Papa = require('papaparse');
  const data = tasks.map(t => ({
    ID: t.id,
    Title: t.title,
    Status: t.status,
    Priority: t.priority || 'Medium',
    'Due Date': t.due_date || 'N/A',
    'Created Date': t.created_at,
    'Updated Date': t.updated_at
  }));
  const csvString = Papa.unparse(data);
  return Buffer.from(csvString, 'utf-8');
}

function exportExcel(tasks) {
  const XLSX = require('xlsx');
  const data = tasks.map(t => ({
    ID: t.id,
    Title: t.title,
    Status: t.status,
    Priority: t.priority || 'Medium',
    'Due Date': t.due_date || 'N/A',
    'Created Date': t.created_at,
    'Updated Date': t.updated_at
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tasks");
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function exportPDF(tasks) {
  const PDFDocument = require('pdfkit');
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      // Header Brand
      doc.fontSize(20).font('Helvetica-Bold').text('YoDo Task - Task Export', { align: 'center' });
      doc.fontSize(9).font('Helvetica-Oblique').text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown(2);

      // Grid Headers (ID, Title, Status, Priority, Due Date, Created)
      const headers = ['ID', 'Title', 'Status', 'Priority', 'Due Date', 'Created'];
      const widths = [25, 200, 70, 60, 65, 60];
      
      let startY = doc.y;
      doc.font('Helvetica-Bold').fontSize(10);
      
      let currentX = 40;
      headers.forEach((h, i) => {
        doc.text(h, currentX, startY, { width: widths[i] });
        currentX += widths[i];
      });

      doc.moveDown(0.5);
      doc.lineCap('butt').moveTo(40, doc.y).lineTo(560, doc.y).strokeColor('#d1d5db').strokeWidth(1).stroke();
      doc.moveDown(0.5);

      // Tasks records
      doc.font('Helvetica').fontSize(9);
      
      tasks.forEach(t => {
        if (doc.y > 700) {
          doc.addPage();
          startY = 40;
          doc.font('Helvetica-Bold');
          currentX = 40;
          headers.forEach((h, i) => {
            doc.text(h, currentX, startY, { width: widths[i] });
            currentX += widths[i];
          });
          doc.moveDown(0.5);
          doc.lineCap('butt').moveTo(40, doc.y).lineTo(560, doc.y).strokeColor('#d1d5db').strokeWidth(1).stroke();
          doc.moveDown(0.5);
          doc.font('Helvetica');
        }

        const rowY = doc.y;
        doc.text(String(t.id), 40, rowY, { width: widths[0] });
        doc.text(t.title, 65, rowY, { width: widths[1] });
        doc.text(t.status, 265, rowY, { width: widths[2] });
        doc.text(t.priority || 'Medium', 335, rowY, { width: widths[3] });
        doc.text(t.due_date || 'N/A', 395, rowY, { width: widths[4] });
        doc.text(t.created_at.split(' ')[0], 460, rowY, { width: widths[5] });
        
        doc.moveDown(0.8);
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function exportWord(tasks) {
  const docx = require('docx');
  const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, HeadingLevel } = docx;

  const tableRows = [];

  // Header Word Row
  tableRows.push(
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "ID", bold: true, size: 20 })] })], width: { size: 8, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Title", bold: true, size: 20 })] })], width: { size: 42, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Status", bold: true, size: 20 })] })], width: { size: 14, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Priority", bold: true, size: 20 })] })], width: { size: 12, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Due Date", bold: true, size: 20 })] })], width: { size: 12, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Created", bold: true, size: 20 })] })], width: { size: 12, type: WidthType.PERCENTAGE } }),
      ]
    })
  );

  // Fill in records
  tasks.forEach(t => {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: String(t.id), spacing: { before: 80, after: 80 } })] }),
          new TableCell({ children: [new Paragraph({ text: t.title, spacing: { before: 80, after: 80 } })] }),
          new TableCell({ children: [new Paragraph({ text: t.status, spacing: { before: 80, after: 80 } })] }),
          new TableCell({ children: [new Paragraph({ text: t.priority || 'Medium', spacing: { before: 80, after: 80 } })] }),
          new TableCell({ children: [new Paragraph({ text: t.due_date || 'N/A', spacing: { before: 80, after: 80 } })] }),
          new TableCell({ children: [new Paragraph({ text: t.created_at.split(' ')[0], spacing: { before: 80, after: 80 } })] }),
        ]
      })
    );
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: "YoDo Task - Exported Tasks",
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 }
        }),
        new Paragraph({
          text: `Generated on: ${new Date().toLocaleString()}`,
          spacing: { after: 400 }
        }),
        new Table({
          rows: tableRows,
          width: { size: 100, type: WidthType.PERCENTAGE }
        })
      ]
    }]
  });

  return Packer.toBuffer(doc);
}

function exportText(tasks) {
  let out = "YoDo Task Export - Tasks List\n";
  out += `Generated on: ${new Date().toLocaleString()}\n`;
  out += "====================================================================================================\n";
  out += `${"ID".padEnd(5)} | ${"Title".padEnd(30)} | ${"Status".padEnd(12)} | ${"Priority".padEnd(10)} | ${"Due Date".padEnd(10)} | Created Date\n`;
  out += "----------------------------------------------------------------------------------------------------\n";
  
  tasks.forEach(t => {
    const id = String(t.id).padEnd(5);
    const title = (t.title.length > 27 ? t.title.substring(0, 27) + '...' : t.title).padEnd(30);
    const status = t.status.padEnd(12);
    const priority = (t.priority || 'Medium').padEnd(10);
    const due = (t.due_date || 'N/A').padEnd(10);
    const created = t.created_at.split(' ')[0];
    out += `${id} | ${title} | ${status} | ${priority} | ${due} | ${created}\n`;
  });
  
  out += "====================================================================================================\n";
  return Buffer.from(out, 'utf-8');
}

/**
 * Parses files to import ToDos back into schema arrays.
 * Supports Excel sheets, CSV text, raw text lists, and JSON text.
 * @param {Buffer|string} data Raw file data
 * @param {string} fileType Extension (csv, xlsx, json, txt)
 * @returns {Array} List of mapped ToDo objects { title, status, due_date, priority }
 */
function parseImport(data, fileType) {
  const normType = fileType.toLowerCase();

  switch (normType) {
    case 'json':
      return parseJSON(data.toString('utf-8'));
    case 'csv':
      return parseCSV(data.toString('utf-8'));
    case 'xlsx':
      return parseExcel(data);
    case 'txt':
    default:
      return parseText(data.toString('utf-8'));
  }
}

function parseJSON(str) {
  const parsed = JSON.parse(str);
  const items = Array.isArray(parsed) ? parsed : (parsed.todos || []);
  return items.map(item => ({
    title: item.title || item.Title,
    status: item.status || item.Status || 'Open',
    priority: item.priority || item.Priority || 'Medium',
    due_date: item.due_date || item.dueDate || item['Due Date'] || null
  }));
}

function parseCSV(str) {
  const Papa = require('papaparse');
  const parsed = Papa.parse(str, { header: true, skipEmptyLines: true });
  return parsed.data.map(row => {
    const title = row.Title || row.title || row.task || Object.values(row)[1] || '';
    let status = row.Status || row.status || 'Open';
    
    // Normalize status names
    if (status.toLowerCase().startsWith('o')) status = 'Open';
    else if (status.toLowerCase().startsWith('i') || status.toLowerCase().includes('prog')) status = 'In Progress';
    else if (status.toLowerCase().startsWith('c') && !status.toLowerCase().includes('anc')) status = 'Completed';
    else if (status.toLowerCase().startsWith('can')) status = 'Canceled';
    
    const priority = row.Priority || row.priority || 'Medium';
    const dueDate = row['Due Date'] || row.due_date || row.dueDate || null;
    return {
      title: title.trim(),
      status,
      priority: priority.trim(),
      due_date: dueDate === 'N/A' || !dueDate ? null : dueDate.trim()
    };
  }).filter(t => t.title);
}

function parseExcel(buffer) {
  const XLSX = require('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet);
  
  return rows.map(row => {
    const title = row.Title || row.title || row.task || '';
    let status = row.Status || row.status || 'Open';
    
    // Normalize status
    if (status.toLowerCase().startsWith('o')) status = 'Open';
    else if (status.toLowerCase().startsWith('i') || status.toLowerCase().includes('prog')) status = 'In Progress';
    else if (status.toLowerCase().startsWith('c') && !status.toLowerCase().includes('anc')) status = 'Completed';
    else if (status.toLowerCase().startsWith('can')) status = 'Canceled';

    const priority = row.Priority || row.priority || 'Medium';
    const dueDate = row['Due Date'] || row.due_date || row.dueDate || null;
    return {
      title: String(title).trim(),
      status,
      priority: String(priority).trim(),
      due_date: dueDate === 'N/A' || !dueDate ? null : String(dueDate).trim()
    };
  }).filter(t => t.title);
}

function parseText(str) {
  const lines = str.split(/\r?\n/);
  const items = [];
  
  lines.forEach(line => {
    const trim = line.trim();
    if (!trim || trim.startsWith('===') || trim.startsWith('---') || trim.startsWith('ID |')) return;
    
    if (trim.includes('|')) {
      const parts = trim.split('|').map(p => p.trim());
      const title = parts[1];
      if (title && title !== 'Title') {
        let status = parts[2] || 'Open';
        if (status.toLowerCase().startsWith('o')) status = 'Open';
        else if (status.toLowerCase().startsWith('i') || status.toLowerCase().includes('prog')) status = 'In Progress';
        else if (status.toLowerCase().startsWith('c') && !status.toLowerCase().includes('anc')) status = 'Completed';
        else if (status.toLowerCase().startsWith('can')) status = 'Canceled';

        const priority = parts[3] || 'Medium';
        const due = parts[4] === 'N/A' || !parts[4] ? null : parts[4];
        items.push({ title, status, priority, due_date: due });
      }
    } else {
      // Raw title per line
      items.push({ title: trim, status: 'Open', priority: 'Medium', due_date: null });
    }
  });
  
  return items;
}

module.exports = {
  exportTasks,
  parseImport
};
