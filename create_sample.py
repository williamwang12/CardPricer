"""Generate sample_input.xlsx for testing the Card Pricer."""
import openpyxl

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Cards"

headers = ["Name", "Number", "Quantity"]
ws.append(headers)

cards = [
    ["Charizard ex", "223/197", 1],
    ["Pikachu", "025/165", 2],
    ["Mewtwo ex", "150/165", 1],
    ["Umbreon VMAX", "215/203", 1],
    ["Lugia V", "186/195", 1],
    ["Gardevoir ex", "086/198", 1],
    ["Eevee", "133/165", 3],
    ["Mew ex", "151/165", 1],
]

for card in cards:
    ws.append(card)

# Auto-size columns
for col in ws.columns:
    max_length = max(len(str(cell.value or "")) for cell in col)
    ws.column_dimensions[col[0].column_letter].width = max_length + 2

wb.save("sample_input.xlsx")
print("Created sample_input.xlsx")
